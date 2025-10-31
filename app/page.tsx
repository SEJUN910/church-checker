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

interface WeeklyEvent {
  id: string;
  title: string;
  start_datetime: string;
  event_type: string;
  church_id: string;
}

interface ChurchStats {
  churchId: string;
  totalStudents: number;
  thisWeekAttendance: number;
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
  const [dailyVerse, setDailyVerse] = useState<{ text: string; reference: string } | null>(null);
  const [allWeeklyEvents, setAllWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [churchStats, setChurchStats] = useState<Map<string, ChurchStats>>(new Map());

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    loadDailyVerse();
  }, []);

  useEffect(() => {
    if (churches.length > 0) {
      loadAllWeeklyEvents();
      loadChurchStats();
    }
  }, [churches]);

  const loadDailyVerse = async () => {
    try {
      const response = await fetch('/api/daily-verse');
      if (response.ok) {
        const data = await response.json();
        setDailyVerse({ text: data.text, reference: data.reference });
      }
    } catch (error) {
      console.error('Failed to load daily verse:', error);
    }
  };

  const loadAllWeeklyEvents = async () => {
    try {
      const today = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from('church_events')
        .select('id, title, start_datetime, event_type, church_id')
        .gte('start_datetime', today.toISOString())
        .lte('start_datetime', weekFromNow.toISOString())
        .order('start_datetime', { ascending: true });

      if (error) throw error;
      setAllWeeklyEvents(data || []);
    } catch (error) {
      console.error('전체 주간 일정 로드 실패:', error);
    }
  };

  const loadChurchStats = async () => {
    try {
      const statsMap = new Map<string, ChurchStats>();

      for (const church of churches) {
        // 총 학생 수
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .eq('church_id', church.id);

        if (studentsError) throw studentsError;

        // 이번 주 출석 (일요일부터 토요일까지)
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // 일요일
        startOfWeek.setHours(0, 0, 0, 0);

        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('student_id')
          .eq('church_id', church.id)
          .gte('date', startOfWeek.toISOString().split('T')[0]);

        if (attendanceError) throw attendanceError;

        // 중복 제거 (같은 학생이 여러 번 출석한 경우)
        const uniqueAttendees = new Set(attendance?.map(a => a.student_id) || []);

        statsMap.set(church.id, {
          churchId: church.id,
          totalStudents: students?.length || 0,
          thisWeekAttendance: uniqueAttendees.size
        });
      }

      setChurchStats(statsMap);
    } catch (error) {
      console.error('교회 통계 로드 실패:', error);
    }
  };

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
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-900">
              {userName}님 🙏
            </h1>
            <Link href="/settings">
              <button className="rounded-lg p-2 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-5">
        {/* 오늘의 말씀 */}
        {dailyVerse && (
          <div className="mb-5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border border-amber-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-sm font-bold text-amber-800">오늘의 말씀</span>
            </div>
            <p className="text-[15px] text-gray-800 leading-relaxed mb-3 font-medium">
              {dailyVerse.text}
            </p>
            <p className="text-xs font-semibold text-amber-700 text-right">
              - {dailyVerse.reference}
            </p>
          </div>
        )}

        {/* 이번 주 일정 서머리 */}
        {allWeeklyEvents.length > 0 && (
          <div className="mb-5 rounded-xl bg-white border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">이번 주 일정</h3>
              <span className="text-xs text-gray-500">{allWeeklyEvents.length}개</span>
            </div>
            <div className="space-y-1.5">
              {allWeeklyEvents.slice(0, 5).map((event) => {
                const eventDate = new Date(event.start_datetime);
                const today = new Date();
                const isToday = eventDate.toDateString() === today.toDateString();

                const church = churches.find(c => c.id === event.church_id);

                return (
                  <div key={event.id} className="flex items-center gap-2 text-xs">
                    <span className={`${isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                      {eventDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-900 font-medium truncate flex-1">{event.title}</span>
                    {church && (
                      <span className="text-gray-400 text-[10px]">{church.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 교회/모임 목록 - 메인 컨텐츠 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">내 교회/모임&nbsp;<span className="text-xs text-gray-500 mt-0.5">{churches.length}개</span></h2>
            </div>
          </div>

          {churches.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">🏛️</div>
              <p className="text-sm font-semibold text-gray-900 mb-1">아직 교회가 없어요</p>
              <p className="text-xs text-gray-500 mb-3">
                첫 번째 교회를 만들고 출석 관리를 시작해보세요
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
              >
                지금 시작하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {churches.map((church) => {
                const stats = churchStats.get(church.id);
                return (
                  <div key={church.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/church/${church.id}`} className="flex-1">
                        <div className="flex items-center gap-2">
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 px-1">
                              {church.name}
                            </h4>
                            {church.description && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                {church.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteChurch(church.id);
                        }}
                        className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* 통계 정보 */}
                    {stats && (
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-center">
                          <p className="text-[10px] text-blue-600 mb-0.5">이번 주 출석</p>
                          <p className="text-lg font-bold text-blue-600">{stats.thisWeekAttendance}</p>
                        </div>
                        <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center">
                          <p className="text-[10px] text-gray-600 mb-0.5">총 인원</p>
                          <p className="text-lg font-bold text-gray-700">{stats.totalStudents}</p>
                        </div>
                      </div>
                    )}

                    {/* 바로가기 버튼 */}
                    <div className="grid grid-cols-4 gap-2">
                      <Link href={`/church/${church.id}`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <span className="text-[9px] text-gray-600 font-medium">출석</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/prayer`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-green-50 transition-colors">
                          <span className="text-sm">🙏</span>
                          <span className="text-[9px] text-gray-600 font-medium">기도</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/calendar`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-purple-50 transition-colors">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[9px] text-gray-600 font-medium">일정</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/offerings`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-orange-50 transition-colors">
                          <span className="text-sm">💰</span>
                          <span className="text-[9px] text-gray-600 font-medium">헌금</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>



        {/* 하단 여백 */}
        <div className="mb-20"></div>
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
