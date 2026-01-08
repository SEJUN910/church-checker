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
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/');
      } else {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  const handleKakaoLogin = () => {
    window.location.href = '/api/auth/kakao';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* 배경 */}
      <div className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
           style={{
             backgroundImage:
               'url(https://uvfkbaagtgvllbhwoufc.supabase.co/storage/v1/object/public/student-photos/Gemini_Generated_Image_g2mq6ig2mq6ig2mq.png)'
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/10" />
      </div>

      {/* 콘텐츠 */}
      <div className="w-full max-w-md text-center text-white drop-shadow-lg animate-fade-in">
        <h1 className="mb-2 text-5xl font-black tracking-tight text-white"
            style={{ fontFamily: '"Pretendard", sans-serif' }}>
          엔크리스토
        </h1>
        {/* <p className="text-lg text-white/90 font-medium"
            style={{ fontFamily: '"Pretendard", sans-serif' }}>
          그리스도 안에서
        </p> */}
        <p className="mt-1 text-md text-white/80 italic" style={{ fontFamily: 'var(--font-noto-serif)' }}>
          ἐν Χριστῷ
        </p>

        {/* 앱 사용 목적 안내 */}
        <p className="mt-8 mb-10 text-base text-white/85 font-light">
          함께 모이고, 함께 기도하는 공동체
        </p>


        {/* 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-6 py-4
          font-bold text-black shadow-xl transition-all hover:bg-[#FDD835] active:scale-[0.98]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.8-.7 2.8-.8 3.2-.1.5.2.5.4.4.3-.1 3.7-2.5 4.3-2.9.5.1 1 .1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>
          </svg>
          카카오로 시작하기
        </button>

        {/* 서브 액션 */}
        <p className="mt-4 text-xs text-white/70">
          로그인이 안 되나요? <span className="underline cursor-pointer">문의하기</span>
        </p>
      </div>
    </div>
  );
}
