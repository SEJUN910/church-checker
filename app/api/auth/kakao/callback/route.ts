import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  console.log('Kakao callback received, code:', code?.substring(0, 10) + '...');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

    if (!clientId) {
      throw new Error('KAKAO_REST_API_KEY not configured');
    }

    console.log('Getting token from Kakao...');

    // 1. 카카오 토큰 받기
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: `${origin}/api/auth/kakao/callback`,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to get token');
    }

    console.log('Token received, getting user info...');

    // 2. 카카오 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('User info error:', userData);
      throw new Error('Failed to get user info');
    }

    console.log('User info received:', userData.id, userData.properties?.nickname);

    // 3. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 4. 카카오 ID를 사용하여 고유 이메일 생성
    const email = `kakao_${userData.id}@kakao.local`;
    const name = userData.properties?.nickname || '카카오 사용자';
    const avatarUrl = userData.properties?.profile_image;
    const password = `kakao_${userData.id}_secure_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}`;

    console.log('Checking if user exists:', email);

    // 5. 기존 사용자 확인 및 로그인 시도
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInData?.user) {
      // 기존 사용자 - 로그인 성공
      console.log('Existing user logged in:', signInData.user.id);

      // 프로필 확인
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', signInData.user.id)
        .maybeSingle();

      // 프로필이 없으면 생성
      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: signInData.user.id,
          name,
          avatar_url: avatarUrl,
        });
        console.log('Profile created for existing user');
      }

      return NextResponse.redirect(`${origin}/`);

    } else if (signInError?.message.includes('Invalid login credentials')) {
      // 신규 사용자 - 회원가입
      console.log('New user, creating account...');

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            kakao_id: userData.id.toString(),
            avatar_url: avatarUrl,
          },
        },
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('회원가입 실패');
      }

      console.log('User created:', signUpData.user.id);

      // 프로필 생성
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: signUpData.user.id,
          name,
          avatar_url: avatarUrl,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      } else {
        console.log('Profile created');
      }

      // 자동 로그인
      const { error: autoSignInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (autoSignInError) {
        console.error('Auto sign-in error:', autoSignInError);
        throw autoSignInError;
      }

      console.log('Auto sign-in successful, redirecting to profile setup');
      return NextResponse.redirect(`${origin}/profile/setup`);

    } else {
      // 다른 에러
      console.error('Unexpected sign-in error:', signInError);
      throw signInError || new Error('로그인 실패');
    }

  } catch (error) {
    console.error('Kakao auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`);
  }
}
