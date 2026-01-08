import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, id, email, nickname, profileImage } = await request.json();

    if (!accessToken || !id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = await createClient();

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
          email: email,
          name: nickname,
          profile_image: profileImage,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userId = newUser.id;
    }

    // Supabase Auth 세션 생성
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email || `kakao_${id}@temp.com`,
      password: `kakao_${id}_${accessToken.substring(0, 20)}`,
    });

    if (signInError) {
      // 계정이 없으면 생성
      const { error: signUpError } = await supabase.auth.signUp({
        email: email || `kakao_${id}@temp.com`,
        password: `kakao_${id}_${accessToken.substring(0, 20)}`,
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        return NextResponse.json(
          { error: 'Failed to create auth session' },
          { status: 500 }
        );
      }

      // 재로그인 시도
      await supabase.auth.signInWithPassword({
        email: email || `kakao_${id}@temp.com`,
        password: `kakao_${id}_${accessToken.substring(0, 20)}`,
      });
    }

    return NextResponse.json(
      { success: true, userId },
      { status: 200 }
    );
  } catch (error) {
    console.error('Native Kakao auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
