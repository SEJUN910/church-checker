'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || '사용자');
    } else {
      const tempUserId = localStorage.getItem('tempUserId');
      const tempUserName = localStorage.getItem('tempUserName');

      if (tempUserId && tempUserName) {
        setUserId(tempUserId);
        setUserName(tempUserName);
      }
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('tempUserId');
      localStorage.removeItem('tempUserName');
      localStorage.removeItem('showManagementMenu');
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="rounded-lg p-2 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">설정</h1>
              <p className="text-xs text-gray-500">앱 설정 및 관리</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 사용자 정보 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">{userName}</h2>
              <p className="text-sm text-gray-500">
                {userId?.substring(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        {/* 설정 메뉴 */}
        <div className="space-y-3">
          {/* 앱 정보 섹션 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <h3 className="px-5 py-3 text-sm font-bold text-gray-700 bg-gray-50 border-b border-gray-200">
              앱 정보
            </h3>
            <div className="divide-y divide-gray-200">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">버전</p>
                  <p className="text-xs text-gray-500 mt-1">1.0.0</p>
                </div>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">개발자</p>
                  <p className="text-xs text-gray-500 mt-1">Church Checker Team</p>
                </div>
              </div>
            </div>
          </div>

          {/* 데이터 관리 섹션 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <h3 className="px-5 py-3 text-sm font-bold text-gray-700 bg-gray-50 border-b border-gray-200">
              데이터 관리
            </h3>
            <div className="divide-y divide-gray-200">
              <button
                onClick={() => {
                  if (confirm('로컬 캐시를 삭제하시겠습니까?\n관리 메뉴 상태 등이 초기화됩니다.')) {
                    localStorage.removeItem('showManagementMenu');
                    alert('캐시가 삭제되었습니다.');
                  }
                }}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">캐시 삭제</p>
                  <p className="text-xs text-gray-500 mt-1">앱 설정 초기화</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* 계정 관리 섹션 */}
          <div className="rounded-xl bg-white border border-red-200 overflow-hidden">
            <h3 className="px-5 py-3 text-sm font-bold text-red-700 bg-red-50 border-b border-red-200">
              계정 관리
            </h3>
            <div className="divide-y divide-red-200">
              <button
                onClick={handleLogout}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-red-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-red-600">로그아웃</p>
                  <p className="text-xs text-red-500 mt-1">현재 계정에서 로그아웃</p>
                </div>
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* 푸터 정보 */}
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">
              Made with ❤️ for Church Communities
            </p>
            <p className="text-xs text-gray-400 mt-1">
              © 2025 Church Checker
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
