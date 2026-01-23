import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, id, nickname, profileImage } = await request.json();

    console.log('Native Kakao login attempt:', { id, nickname });

    if (!accessToken || !id) {
      console.error('Missing required fields:', { accessToken: !!accessToken, id: !!id });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 웹 로그인과 동일한 방식 사용
    const userEmail = `kakao_${id}@kakao.local`;
    const name = nickname || '카카오 사용자';
    const avatarUrl = profileImage;
    // NEXT_PUBLIC_ 변수는 서버에서도 접근 가능하지만, 없을 경우를 대비해 로깅
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    console.log('Anon key available:', !!anonKey, anonKey?.substring(0, 10));
    const password = `kakao_${id}_secure_${anonKey?.substring(0, 20)}`;

    console.log('Checking if user exists:', userEmail);

    // 기존 사용자 확인 및 로그인 시도
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
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
          kakao_id: id.toString(),
        });
        console.log('Profile created for existing user');
      }

      return NextResponse.json(
        { success: true, userId: signInData.user.id, isNewUser: false },
        { status: 200 }
      );

    } else if (signInError?.message.includes('Invalid login credentials')) {
      // 신규 사용자 - 회원가입
      console.log('New user, creating account...');

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: {
          data: {
            name,
            kakao_id: id.toString(),
            avatar_url: avatarUrl,
          },
        },
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        return NextResponse.json(
          { error: `Failed to create account: ${signUpError.message}` },
          { status: 500 }
        );
      }

      if (!signUpData.user) {
        return NextResponse.json(
          { error: '회원가입 실패' },
          { status: 500 }
        );
      }

      console.log('User created:', signUpData.user.id);

      // 프로필 생성
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: signUpData.user.id,
          name,
          avatar_url: avatarUrl,
          kakao_id: id.toString(),
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      } else {
        console.log('Profile created');
      }

      // 자동 로그인
      const { error: autoSignInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (autoSignInError) {
        console.error('Auto sign-in error:', autoSignInError);
        return NextResponse.json(
          { error: `Auto sign-in failed: ${autoSignInError.message}` },
          { status: 500 }
        );
      }

      console.log('Native Kakao signup success:', { userId: signUpData.user.id });

      return NextResponse.json(
        { success: true, userId: signUpData.user.id, isNewUser: true },
        { status: 200 }
      );

    } else {
      // 다른 에러
      console.error('Unexpected sign-in error:', signInError);
      return NextResponse.json(
        { error: signInError?.message || '로그인 실패' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Native Kakao auth error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
