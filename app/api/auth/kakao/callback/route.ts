import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    // 카카오 토큰 받기
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY || 'cfd682402094edfc183ac980df7c55a0',
        redirect_uri: `${origin}/api/auth/kakao/callback`,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to get token');
    }

    // 카카오 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    // Supabase에 사용자 생성 또는 로그인
    const supabase = await createClient();

    // 카카오 ID를 사용하여 고유 이메일 생성 (이메일이 없을 경우)
    const email = userData.kakao_account?.email || `kakao_${userData.id}@kakao.local`;
    const name = userData.properties?.nickname || '카카오 사용자';

    // Supabase Auth에 사용자 등록/로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: `kakao_${userData.id}_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    });

    // 사용자가 없으면 생성
    if (authError && authError.message.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: `kakao_${userData.id}_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        options: {
          data: {
            name,
            kakao_id: userData.id,
            avatar_url: userData.properties?.profile_image,
          },
        },
      });

      if (signUpError) throw signUpError;

      // 프로필 생성
      if (signUpData.user) {
        await supabase.from('profiles').insert({
          id: signUpData.user.id,
          name,
          avatar_url: userData.properties?.profile_image,
        });
      }
    }

    // 프로필 설정 페이지로 리다이렉트
    return NextResponse.redirect(`${origin}/profile/setup`);
  } catch (error) {
    console.error('Kakao auth error:', error);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
}
