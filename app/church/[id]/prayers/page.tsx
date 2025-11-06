'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';

interface PrayerRequest {
  id: string;
  church_id: string;
  student_id: string | null;
  title: string;
  content: string;
  is_anonymous: boolean;
  is_answered: boolean;
  answer_testimony: string | null;
  answered_at: string | null;
  created_by: string;
  created_at: string;
  category?: string;
  status?: string;
  student?: {
    name: string;
  };
  created_by_name?: string;
}

export default function PrayersPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [filteredPrayers, setFilteredPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [newPrayer, setNewPrayer] = useState({
    title: '',
    content: '',
    is_anonymous: false,
    student_id: '',
    category: '일반',
    status: '진행중'
  });

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    loadPrayers();
    loadStudents();
  }, [churchId]);

  useEffect(() => {
    filterPrayers();
  }, [prayers, statusFilter, searchQuery]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('church_id', churchId)
        .order('name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
    }
  };

  const loadPrayers = async () => {
    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 작성자 정보 가져오기
      const prayersWithAuthors = await Promise.all(
        (data || []).map(async (prayer) => {
          // 익명이 아닌 경우 작성자 이름 가져오기
          if (!prayer.is_anonymous) {
            // 학생 정보가 있는 경우
            if (prayer.student_id) {
              const { data: student } = await supabase
                .from('students')
                .select('name')
                .eq('id', prayer.student_id)
                .single();
              if (student) {
                return { ...prayer, student };
              }
            }
            // 학생 정보가 없는 경우 프로필에서 가져오기
            else if (prayer.created_by) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', prayer.created_by)
                .single();
              if (profile) {
                return { ...prayer, created_by_name: profile.name };
              }
            }
          }
          return prayer;
        })
      );

      setPrayers(prayersWithAuthors);
    } catch (error) {
      console.error('기도제목 로드 실패:', error);
      toast.error('기도제목을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterPrayers = () => {
    let filtered = [...prayers];

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(prayer => prayer.status === statusFilter);
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      filtered = filtered.filter(prayer =>
        prayer.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPrayers(filtered);
  };

  const handleCreatePrayer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .insert([{
          ...newPrayer,
          church_id: churchId,
          created_by: userId,
          student_id: newPrayer.student_id || null
        }])
        .select()
        .single();

      if (error) throw error;

      // 학생 정보 추가
      if (data.student_id && !data.is_anonymous) {
        const student = students.find(s => s.id === data.student_id);
        data.student = student ? { name: student.name } : undefined;
      }

      // 기도제목 목록에 추가
      setPrayers([data, ...prayers]);
      setShowPrayerModal(false);
      setNewPrayer({
        title: '',
        content: '',
        is_anonymous: false,
        student_id: '',
        category: '일반',
        status: '진행중'
      });
      toast.success('기도제목이 등록되었습니다 🙏');
    } catch (error) {
      console.error('기도제목 생성 실패:', error);
      toast.error('기도제목을 등록하는데 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">기도제목을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />

      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/church/${churchId}`}>
                <button className="rounded-lg p-2 hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <h1 className="text-base font-semibold text-gray-900">기도제목</h1>
            </div>
            <button
              onClick={() => setShowPrayerModal(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
            >
              작성
            </button>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="mx-auto max-w-md px-5 py-4 space-y-3">
        {/* 검색 */}
        <div className="relative">
          <input
            type="text"
            placeholder="제목으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', '진행중', '응답됨', '대기중'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? '전체' : status}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 pb-5">
        {filteredPrayers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="mb-3 text-5xl">🙏</div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              {searchQuery || statusFilter !== 'all' ? '검색 결과가 없습니다' : '기도제목이 없습니다'}
            </p>
            <p className="text-xs text-gray-500">
              {searchQuery || statusFilter !== 'all' ? '다른 조건으로 검색해보세요' : '첫 기도제목을 작성해보세요'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPrayers.map((prayer) => (
              <Link
                key={prayer.id}
                href={`/church/${churchId}/prayer/${prayer.id}`}
                className="block"
              >
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">
                        {prayer.title}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {prayer.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {prayer.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        prayer.status === '응답됨' ? 'bg-green-100 text-green-700' :
                        prayer.status === '진행중' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {prayer.status}
                      </span>
                    )}
                    {prayer.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                        {prayer.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {prayer.is_anonymous ? '익명' : (prayer.student?.name || prayer.created_by_name || '작성자')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(prayer.created_at).toLocaleDateString('ko-KR', {
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 기도 등록 모달 */}
      {showPrayerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">기도제목 등록</h2>
              <p className="text-sm text-gray-500">함께 기도할 제목을 등록해주세요</p>
            </div>

            <form onSubmit={handleCreatePrayer} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">제목</label>
                <input
                  type="text"
                  value={newPrayer.title}
                  onChange={(e) => setNewPrayer({ ...newPrayer, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 시험 합격을 위한 기도"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">내용</label>
                <textarea
                  value={newPrayer.content}
                  onChange={(e) => setNewPrayer({ ...newPrayer, content: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="기도제목을 자세히 적어주세요"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-900">카테고리</label>
                  <select
                    value={newPrayer.category}
                    onChange={(e) => setNewPrayer({ ...newPrayer, category: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="일반">일반</option>
                    <option value="개인">개인</option>
                    <option value="가족">가족</option>
                    <option value="건강">건강</option>
                    <option value="학업">학업</option>
                    <option value="진로">진로</option>
                    <option value="관계">관계</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-900">상태</label>
                  <select
                    value={newPrayer.status}
                    onChange={(e) => setNewPrayer({ ...newPrayer, status: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="진행중">진행중</option>
                    <option value="응답됨">응답됨</option>
                    <option value="대기중">대기중</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">대상자 (선택)</label>
                <select
                  value={newPrayer.student_id}
                  onChange={(e) => setNewPrayer({ ...newPrayer, student_id: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  disabled={newPrayer.is_anonymous}
                >
                  <option value="">선택 안 함</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={newPrayer.is_anonymous}
                  onChange={(e) => setNewPrayer({
                    ...newPrayer,
                    is_anonymous: e.target.checked,
                    student_id: e.target.checked ? '' : newPrayer.student_id
                  })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <label htmlFor="anonymous" className="text-sm font-medium text-gray-700">
                  익명으로 등록
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPrayerModal(false);
                    setNewPrayer({
                      title: '',
                      content: '',
                      is_anonymous: false,
                      student_id: '',
                      category: '일반',
                      status: '진행중'
                    });
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  등록
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
