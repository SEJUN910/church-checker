'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';

interface Church {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
}

export default function Home() {
  const router = useRouter();
  const [churches, setChurches] = useState<Church[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChurchName, setNewChurchName] = useState('');
  const [newChurchDesc, setNewChurchDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || '사용자');
      loadChurches();
    } else {
      const tempUserId = localStorage.getItem('tempUserId');
      const tempUserName = localStorage.getItem('tempUserName');

      if (tempUserId && tempUserName) {
        setUserId(tempUserId);
        setUserName(tempUserName);
        loadChurches();
      } else {
        router.push('/login');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tempUserId');
    localStorage.removeItem('tempUserName');
    router.push('/login');
  };

  const loadChurches = async () => {
    try {
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChurches(data || []);
    } catch (error) {
      console.error('교회 목록 로드 실패:', error);
      alert('교회 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChurchName.trim() || !userId) return;

    try {
      const { data, error } = await supabase
        .from('churches')
        .insert([
          {
            name: newChurchName,
            description: newChurchDesc || null,
            owner_id: userId
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setChurches([data, ...churches]);
      setNewChurchName('');
      setNewChurchDesc('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('교회 생성 실패:', error);
      alert('교회를 생성하는데 실패했습니다.');
    }
  };

  const handleDeleteChurch = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('churches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setChurches(churches.filter(church => church.id !== id));
    } catch (error) {
      console.error('교회 삭제 실패:', error);
      alert('교회를 삭제하는데 실패했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">안녕하세요</p>
              <h1 className="text-2xl font-extrabold text-gray-900">{userName}님</h1>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 통계 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">내 교회/모임</h2>
            <span className="text-xs text-gray-500">{churches.length}개</span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-2.5 text-center">
              <p className="text-xs text-blue-600 mb-0.5">오늘</p>
              <p className="text-xl font-bold text-blue-600">0</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-2.5 text-center">
              <p className="text-xs text-green-600 mb-0.5">이번 주</p>
              <p className="text-xl font-bold text-green-600">0</p>
            </div>
          </div>
        </div>

        {/* 교회 목록 */}
        <div className="mb-20">
          <h3 className="mb-2 text-xs font-bold text-gray-700">교회/모임 목록</h3>

          {churches.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">🏛️</div>
              <p className="text-sm font-bold text-gray-900 mb-1">아직 교회가 없어요</p>
              <p className="text-xs text-gray-500">
                아래 버튼을 눌러 첫 번째 교회를 만들어보세요
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {churches.map((church) => (
                <Link
                  key={church.id}
                  href={`/church/${church.id}`}
                  className="block"
                >
                  <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-gray-900 mb-1">
                          {church.name}
                        </h4>
                        {church.description && (
                          <p className="text-xs text-gray-600 mb-2">
                            {church.description}
                          </p>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(church.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteChurch(church.id);
                        }}
                        className="ml-3 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-5">
        <div className="mx-auto max-w-md">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            새 교회 만들기
          </button>
        </div>
      </div>

      {/* 생성 모달 - 토스 스타일 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                새 교회 만들기
              </h2>
              <p className="text-sm text-gray-500">
                교회 이름과 설명을 입력해주세요
              </p>
            </div>

            <form onSubmit={handleCreateChurch} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  이름
                </label>
                <input
                  type="text"
                  value={newChurchName}
                  onChange={(e) => setNewChurchName(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 사랑의교회 청소년부"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  설명 (선택)
                </label>
                <textarea
                  value={newChurchDesc}
                  onChange={(e) => setNewChurchDesc(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewChurchName('');
                    setNewChurchDesc('');
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
                >
                  만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
