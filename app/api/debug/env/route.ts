import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasKakaoKey: !!process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY,
    kakaoKeyLength: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.length || 0,
    kakaoKeyPrefix: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.substring(0, 10) || 'not set',
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
