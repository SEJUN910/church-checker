import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      // 에러가 있어도 프로필 설정으로 이동 (이메일 없어도 진행)
      return NextResponse.redirect(`${origin}/profile/setup?error=${error.message}`);
    }
  }

  // 프로필 설정 페이지로 리다이렉트 (첫 로그인인 경우)
  // 또는 메인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/profile/setup`);
}
