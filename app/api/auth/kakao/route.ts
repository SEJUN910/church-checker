import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  // 카카오 OAuth URL 직접 생성 (account_email 제외)
  const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize');

  const clientId = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

  if (!clientId) {
    return NextResponse.json({ error: 'KAKAO_REST_API_KEY not configured' }, { status: 500 });
  }

  kakaoAuthUrl.searchParams.set('client_id', clientId);
  kakaoAuthUrl.searchParams.set('redirect_uri', `${origin}/api/auth/kakao/callback`);
  kakaoAuthUrl.searchParams.set('response_type', 'code');
  // account_email 제외하고 scope 설정
  kakaoAuthUrl.searchParams.set('scope', 'profile_nickname profile_image');

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
