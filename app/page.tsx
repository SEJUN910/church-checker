'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

  // Supabase에서 교회 목록 불러오기
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
      // 임시 사용자 체크
      const tempUserId = localStorage.getItem('tempUserId');
      const tempUserName = localStorage.getItem('tempUserName');

      if (tempUserId && tempUserName) {
        setUserId(tempUserId);
        setUserName(tempUserName);
        loadChurches();
      } else {
        // 로그인되지 않았으면 로그인 페이지로
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
      alert('교회 목록을 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 새 교회 생성
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

  // 교회 삭제
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">✝️</div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white p-4">
      <div className="mx-auto max-w-4xl">
        {/* 사용자 정보 바 */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👤</span>
            <span className="font-semibold text-gray-800">{userName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            로그아웃
          </button>
        </div>

        {/* 헤더 */}
        <header className="mb-8 text-center">
          <div className="mb-2 text-5xl">✝️</div>
          <h1 className="mb-2 text-3xl font-bold text-gray-800">교회 출석 관리</h1>
          <p className="text-sm text-gray-600">교회/모임을 선택하거나 새로 만들어보세요</p>
        </header>

        {/* 새 교회 생성 버튼 */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="mb-6 w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-100"
        >
          <div className="text-3xl">+</div>
          <div className="mt-2 font-semibold">새 교회/모임 만들기</div>
        </button>

        {/* 교회 목록 */}
        <div className="space-y-4">
          {churches.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
              <div className="mb-2 text-4xl">📋</div>
              <p>아직 생성된 교회/모임이 없습니다</p>
              <p className="mt-1 text-sm">위 버튼을 눌러 새로 만들어보세요</p>
            </div>
          ) : (
            churches.map((church) => (
              <div
                key={church.id}
                className="flex items-center justify-between rounded-xl bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
              >
                <Link href={`/church/${church.id}`} className="flex-1">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{church.name}</h3>
                    {church.description && (
                      <p className="mt-1 text-sm text-gray-600">{church.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>📅 {new Date(church.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => handleDeleteChurch(church.id)}
                  className="ml-4 rounded-lg px-4 py-2 text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>

        {/* PWA 안내 */}
        <div className="mt-8 rounded-lg bg-blue-50 p-4 text-center">
          <p className="text-sm text-blue-800">
            📱 홈 화면에 추가하여 앱처럼 사용하실 수 있습니다
          </p>
        </div>
      </div>

      {/* 교회 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">새 교회/모임 만들기</h2>
            <form onSubmit={handleCreateChurch} className="space-y-4">
              <div>
                <label htmlFor="churchName" className="mb-2 block text-sm font-medium text-gray-700">
                  이름 *
                </label>
                <input
                  type="text"
                  id="churchName"
                  value={newChurchName}
                  onChange={(e) => setNewChurchName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 사랑의교회 청소년부"
                  required
                />
              </div>
              <div>
                <label htmlFor="churchDesc" className="mb-2 block text-sm font-medium text-gray-700">
                  설명 (선택)
                </label>
                <textarea
                  id="churchDesc"
                  value={newChurchDesc}
                  onChange={(e) => setNewChurchDesc(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewChurchName('');
                    setNewChurchDesc('');
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
