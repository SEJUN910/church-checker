'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import toast, { Toaster } from 'react-hot-toast';

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

interface Announcement {
  id: string;
  church_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_important: boolean;
  created_at: string;
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
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChurch, setEditingChurch] = useState<Church | null>(null);

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    loadDailyVerse();
  }, []);

  // 팝다운 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 메뉴 컨테이너 외부 클릭 시에만 닫기
      if (!target.closest('.church-menu-container')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

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

  const loadChurchStats = async (churchList: Church[] = churches) => {
    try {
      const statsMap = new Map<string, ChurchStats>();

      for (const church of churchList) {
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

  const loadRecentAnnouncements = async (churchList: Church[] = churches) => {
    try {
      const churchIds = churchList.map(c => c.id);

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .in('church_id', churchIds)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentAnnouncements(data || []);
    } catch (error) {
      console.error('최근 공지 로드 실패:', error);
    }
  };

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    setUserId(user.id);

    // 프로필에서 이름 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    setUserName(profile?.name || user.user_metadata?.name || '사용자');

    // userId를 직접 전달하여 state 업데이트 타이밍 문제 해결
    loadChurches(user.id);
  };


  const loadChurches = async (currentUserId?: string) => {
    try {
      const userIdToUse = currentUserId || userId;
      if (!userIdToUse) return;

      // church_members 테이블을 통해 사용자가 속한 교회만 가져오기
      const { data, error } = await supabase
        .from('church_members')
        .select(`
          church_id,
          role,
          churches (
            id,
            name,
            description,
            owner_id,
            created_at
          )
        `)
        .eq('user_id', userIdToUse)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      // churches 데이터를 추출하여 Church 타입으로 변환
      const userChurches = data?.map((item: any) => ({
        id: item.churches.id,
        name: item.churches.name,
        description: item.churches.description,
        owner_id: item.churches.owner_id,
        created_at: item.churches.created_at
      })).filter((church: any) => church.id) || [];

      setChurches(userChurches);

      // 교회 목록이 로드된 후 관련 데이터 로드 (한 번만 실행)
      if (userChurches.length > 0) {
        loadAllWeeklyEvents();
        loadChurchStats(userChurches);
        loadRecentAnnouncements(userChurches);
      }
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
      // 1. 교회 생성
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

      if (error) {
        console.error('교회 생성 실패:', error);
        toast.error(`교회 생성 실패: ${error.message}`);
        throw error;
      }

      // 2. 생성자를 church_members에 admin으로 추가
      const { error: memberError } = await supabase
        .from('church_members')
        .insert([
          {
            church_id: data.id,
            user_id: userId,
            role: 'admin'
          }
        ]);

      if (memberError) {
        console.error('멤버 추가 실패:', memberError);
        toast.error(`멤버 추가 실패: ${memberError.message}`);
        // 교회는 생성되었지만 멤버 추가 실패 - 교회 삭제
        await supabase.from('churches').delete().eq('id', data.id);
        throw memberError;
      }

      setChurches([data, ...churches]);
      setNewChurchName('');
      setNewChurchDesc('');
      setShowCreateModal(false);
      toast.success('교회가 생성되었습니다!');
    } catch (error: any) {
      console.error('교회 생성 프로세스 실패:', error);
      // 에러는 이미 위에서 alert 했으므로 여기서는 로그만
    }
  };

  const handleEditChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChurch) return;

    try {
      const { error } = await supabase
        .from('churches')
        .update({
          name: editingChurch.name,
          description: editingChurch.description
        })
        .eq('id', editingChurch.id);

      if (error) {
        console.error('교회 수정 실패:', error);
        toast.error(`교회 수정 실패: ${error.message}`);
        throw error;
      }

      setChurches(churches.map(c => c.id === editingChurch.id ? editingChurch : c));
      setShowEditModal(false);
      setEditingChurch(null);
      toast.success('교회 정보가 수정되었습니다!');
    } catch (error: any) {
      console.error('교회 수정 프로세스 실패:', error);
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
      toast.success('교회가 삭제되었습니다.');
      setOpenMenuId(null);
    } catch (error) {
      console.error('교회 삭제 실패:', error);
      toast.error('교회를 삭제하는데 실패했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
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

        {/* 최근 공지사항 */}
        {recentAnnouncements.length > 0 && (
          <div className="mb-5 rounded-xl bg-white border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">최근 공지</h3>
              <span className="text-xs text-gray-500">{recentAnnouncements.length}개</span>
            </div>
            <div className="space-y-2">
              {recentAnnouncements.map((announcement) => {
                const church = churches.find(c => c.id === announcement.church_id);
                return (
                  <Link
                    key={announcement.id}
                    href={`/church/${announcement.church_id}/announcements`}
                  >
                    <div className={`p-3 rounded-lg border transition-all hover:border-blue-300 ${
                      announcement.is_important ? 'bg-red-50 border-red-200' :
                      announcement.is_pinned ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start gap-2 mb-1">
                        {announcement.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                            고정
                          </span>
                        )}
                        {announcement.is_important && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">
                            중요
                          </span>
                        )}
                        <span className="text-xs font-semibold text-gray-900 flex-1 truncate">
                          {announcement.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        {church && <span>{church.name}</span>}
                        <span>•</span>
                        <span>
                          {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
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

                      {/* 팝다운 메뉴 */}
                      <div className="relative church-menu-container">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === church.id ? null : church.id);
                          }}
                          className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>

                        {openMenuId === church.id && (
                          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingChurch(church);
                                setShowEditModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              수정
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteChurch(church.id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* 교회 수정 모달 */}
      {showEditModal && editingChurch && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => {
            setShowEditModal(false);
            setEditingChurch(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">모임 수정</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingChurch(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditChurch} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  이름
                </label>
                <input
                  type="text"
                  value={editingChurch.name}
                  onChange={(e) => setEditingChurch({...editingChurch, name: e.target.value})}
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
                  value={editingChurch.description || ''}
                  onChange={(e) => setEditingChurch({...editingChurch, description: e.target.value})}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  생성일
                </label>
                <input
                  type="text"
                  value={new Date(editingChurch.created_at).toLocaleDateString('ko-KR')}
                  disabled
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-500 bg-gray-50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingChurch(null);
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
                >
                  수정
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
