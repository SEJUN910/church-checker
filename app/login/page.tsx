'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">✝️</div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-7xl">✝️</div>
          <h1 className="mb-2 text-4xl font-bold text-gray-800">교회 출석 체크</h1>
          <p className="text-gray-600">간편하게 출석을 관리하세요</p>
        </div>

        {/* 로그인 카드 */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-800">
            시작하기
          </h2>

          {/* 카카오 로그인 버튼 */}
          <button
            onClick={handleKakaoLogin}
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-lg bg-[#FEE500] px-6 py-4 font-semibold text-[#000000] transition-all hover:bg-[#FDD835]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.8-.7 2.8-.8 3.2-.1.5.2.5.4.4.3-.1 3.7-2.5 4.3-2.9.5.1 1 .1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>

          {/* 개발용 임시 로그인 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">개발 모드</span>
            </div>
          </div>

          <button
            onClick={handleDevLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-4 font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            🔧 임시 로그인 (개발용)
          </button>

          <p className="mt-6 text-center text-xs text-gray-500">
            카카오 계정으로 로그인하여<br />
            안전하게 출석을 관리하세요
          </p>
        </div>

        {/* PWA 안내 */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-center">
          <p className="text-sm text-blue-800">
            📱 홈 화면에 추가하여 앱처럼 사용하실 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
