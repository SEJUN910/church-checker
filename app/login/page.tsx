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
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'profile_nickname profile_image'
        }
      });

      if (error) {
        console.error('카카오 로그인 에러:', error);
        alert('카카오 로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      alert('카카오 로그인에 실패했습니다.');
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

        {/* 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-6 py-4 font-bold text-[#000000] transition-all hover:bg-[#FDD835] active:scale-[0.98] shadow-lg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.8-.7 2.8-.8 3.2-.1.5.2.5.4.4.3-.1 3.7-2.5 4.3-2.9.5.1 1 .1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>
          </svg>
          카카오로 시작하기
        </button>
      </div>
    </div>
  );
}
