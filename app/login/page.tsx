'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 이미 로그인되어 있는지 확인
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 이미 로그인되어 있으면 메인 페이지로
      router.push('/');
    } else {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    // 카카오 로그인 구현 (임시로 알림)
    alert('카카오 개발자 앱 설정이 필요합니다.\n\n1. developers.kakao.com 접속\n2. 앱 생성 및 REST API 키 발급\n3. .env.local에 키 입력');

    // TODO: 실제 카카오 로그인 구현
    // const { data, error } = await supabase.auth.signInWithOAuth({
    //   provider: 'kakao',
    //   options: {
    //     redirectTo: `${window.location.origin}/auth/callback`
    //   }
    // });
  };

  // 개발용 임시 로그인 (카카오 설정 전까지)
  const handleDevLogin = async () => {
    try {
      // 임시 사용자로 진입
      const tempUserId = crypto.randomUUID();
      localStorage.setItem('tempUserId', tempUserId);
      localStorage.setItem('tempUserName', '테스트 사용자');

      router.push('/');
    } catch (error) {
      console.error('로그인 실패:', error);
      alert('로그인에 실패했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* 배경 이미지 */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(https://uvfkbaagtgvllbhwoufc.supabase.co/storage/v1/object/public/student-photos/Gemini_Generated_Image_g2mq6ig2mq6ig2mq.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* 오버레이 */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 헤더 */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-5xl font-black text-white drop-shadow-lg">엔크리스토</h1>
          <p className="text-lg text-white/90 font-medium drop-shadow">그리스도 안에서</p>
          <p className="text-sm text-white/80 mt-2 font-light" style={{ fontFamily: 'serif' }}>ἐν Χριστῷ</p>
        </div>

        {/* 로그인 버튼들 */}
        <div className="space-y-3">
          {/* 카카오 로그인 버튼 */}
          <button
            onClick={handleKakaoLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-6 py-4 font-bold text-[#000000] transition-all hover:bg-[#FDD835] active:scale-[0.98] shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.8-.7 2.8-.8 3.2-.1.5.2.5.4.4.3-.1 3.7-2.5 4.3-2.9.5.1 1 .1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>

          {/* 개발용 임시 로그인 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/30"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-white/80">또는</span>
            </div>
          </div>

          <button
            onClick={handleDevLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/50 bg-white/10 backdrop-blur-sm px-6 py-4 font-bold text-white transition-all hover:bg-white/20 active:scale-[0.98] shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            빠른 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
