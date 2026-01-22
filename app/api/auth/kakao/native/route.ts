import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, id, email, nickname, profileImage } = await request.json();

    console.log('Native Kakao login attempt:', { id, email, nickname });

    if (!accessToken || !id) {
      console.error('Missing required fields:', { accessToken: !!accessToken, id: !!id });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 고정 비밀번호 생성 (카카오 ID 기반 - accessToken은 매번 변경되므로 사용하지 않음)
    const fixedPassword = `kakao_native_${id}_secret_key_2024`;
    const userEmail = email || `kakao_${id}@churchecker.app`;

    // 카카오 사용자 정보로 Supabase 인증
    // 기존 사용자 확인 또는 새 사용자 생성
    const { data: existingUser, error: getUserError } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', id.toString())
      .single();

    if (getUserError && getUserError.code !== 'PGRST116') {
      console.error('Error checking user:', getUserError);
      return NextResponse.json(
        { error: 'Failed to check user' },
        { status: 500 }
      );
    }

    let userId: string;

    // 먼저 Supabase Auth 로그인/가입 시도
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: fixedPassword,
    });

    if (signInError) {
      console.log('Sign in failed, trying sign up:', signInError.message);

      // 계정이 없으면 생성
      const { error: signUpError } = await supabase.auth.signUp({
        email: userEmail,
        password: fixedPassword,
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        return NextResponse.json(
          { error: `Failed to create auth session: ${signUpError.message}` },
          { status: 500 }
        );
      }

      // 가입 후 재로그인
      const { error: reSignInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: fixedPassword,
      });

      if (reSignInError) {
        console.error('Re-sign in error:', reSignInError);
        return NextResponse.json(
          { error: `Failed to sign in after signup: ${reSignInError.message}` },
          { status: 500 }
        );
      }
    }

    if (existingUser) {
      // 기존 사용자
      userId = existingUser.id;

      // 사용자 정보 업데이트
      await supabase
        .from('users')
        .update({
          name: nickname || existingUser.name,
          profile_image: profileImage || existingUser.profile_image,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } else {
      // 새 사용자 생성
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          kakao_id: id.toString(),
          email: userEmail,
          name: nickname,
          profile_image: profileImage,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { error: `Failed to create user: ${createError?.message}` },
          { status: 500 }
        );
      }

      userId = newUser.id;
    }

    console.log('Native Kakao login success:', { userId, email: userEmail });

    return NextResponse.json(
      { success: true, userId },
      { status: 200 }
    );
  } catch (error) {
    console.error('Native Kakao auth error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
