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
          .from('members')
          .select('id')
          .eq('church_id', church.id)
          .in('type', ['student', 'teacher']);

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
    <div className="min-h-screen bg-[#fcf9f4]">
      <Toaster position="top-center" />
      {/* 상단 헤더 */}
      <div className="bg-[#fcf9f4]">
        <div className="mx-auto max-w-md px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#41484d] font-medium mb-0.5">안녕하세요</p>
              <h1 className="text-xl font-bold text-[#1c1c19]" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                {userName}님 🙏
              </h1>
            </div>
            <Link href="/settings">
              <button className="rounded-xl p-2 hover:bg-[#f0ede8] transition-colors">
                <svg className="w-5 h-5 text-[#41484d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="mb-5 rounded-2xl bg-[#ffffff] overflow-hidden shadow-[0px_4px_20px_rgba(28,28,25,0.06)] flex">
            {/* Gold 액센트 바 */}
            <div className="w-1 shrink-0 bg-[#c9a84c]" />
            <div className="p-5 flex-1">
              <p className="text-xs font-medium text-[#c9a84c] mb-3 tracking-wide uppercase">오늘의 말씀</p>
              <p className="text-[15px] text-[#1c1c19] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                {dailyVerse.text}
              </p>
              <p className="text-xs font-medium text-[#41484d] text-right">
                — {dailyVerse.reference}
              </p>
            </div>
          </div>
        )}

        {/* 최근 공지사항 */}
        {recentAnnouncements.length > 0 && (
          <div className="mb-5 rounded-2xl bg-[#ffffff] p-4 shadow-[0px_4px_20px_rgba(28,28,25,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1c1c19]">최근 공지</h3>
              <span className="text-xs text-[#41484d]">{recentAnnouncements.length}개</span>
            </div>
            <div className="space-y-2">
              {recentAnnouncements.map((announcement) => {
                const church = churches.find(c => c.id === announcement.church_id);
                return (
                  <Link
                    key={announcement.id}
                    href={`/church/${announcement.church_id}/announcements`}
                  >
                    <div className={`p-3 rounded-xl transition-all active:scale-[0.99] ${
                      announcement.is_important ? 'bg-[#fff4f2]' :
                      announcement.is_pinned ? 'bg-[#f0f6f8]' :
                      'bg-[#f6f3ee]'
                    }`}>
                      <div className="flex items-start gap-2 mb-1">
                        {announcement.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#32617d] text-white">
                            고정
                          </span>
                        )}
                        {announcement.is_important && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#c0392b] text-white">
                            중요
                          </span>
                        )}
                        <span className="text-xs font-semibold text-[#1c1c19] flex-1 truncate">
                          {announcement.title}
                        </span>
                      </div>
                      <p className="text-xs text-[#41484d] line-clamp-2 mb-1">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#41484d]/60">
                        {church && <span>{church.name}</span>}
                        <span>·</span>
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
          <div className="mb-5 rounded-2xl bg-[#ffffff] p-4 shadow-[0px_4px_20px_rgba(28,28,25,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1c1c19]">이번 주 일정</h3>
              <span className="text-xs text-[#41484d]">{allWeeklyEvents.length}개</span>
            </div>
            <div className="space-y-2">
              {allWeeklyEvents.slice(0, 5).map((event) => {
                const eventDate = new Date(event.start_datetime);
                const today = new Date();
                const isToday = eventDate.toDateString() === today.toDateString();
                const church = churches.find(c => c.id === event.church_id);

                return (
                  <div key={event.id} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${isToday ? 'bg-[#f0f6f8]' : ''}`}>
                    <span className={`shrink-0 font-medium ${isToday ? 'text-[#32617d]' : 'text-[#41484d]'}`}>
                      {eventDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                    <span className="text-[#41484d]/40">·</span>
                    <span className="text-[#1c1c19] font-medium truncate flex-1">{event.title}</span>
                    {church && (
                      <span className="text-[#41484d]/50 text-[10px] shrink-0">{church.name}</span>
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
            <h2 className="text-sm font-semibold text-[#1c1c19]">
              내 교회/모임
              <span className="ml-1.5 text-xs font-normal text-[#41484d]">{churches.length}개</span>
            </h2>
          </div>

          {churches.length === 0 ? (
            <div className="rounded-2xl bg-[#ffffff] p-8 text-center shadow-[0px_4px_20px_rgba(28,28,25,0.06)]">
              <div className="mb-3 text-4xl">🏛️</div>
              <p className="text-sm font-semibold text-[#1c1c19] mb-1">아직 교회가 없어요</p>
              <p className="text-xs text-[#41484d] mb-4">첫 번째 교회를 만들고 출석 관리를 시작해보세요</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-2xl px-6 py-2.5 text-sm font-semibold text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 6px_16px_rgba(50,97,125,0.3)' }}
              >
                지금 시작하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {churches.map((church) => {
                const stats = churchStats.get(church.id);
                return (
                  <div key={church.id} className="rounded-2xl bg-[#ffffff] p-4 shadow-[0px_4px_20px_rgba(28,28,25,0.06)] hover:shadow-[0px_8px_28px_rgba(28,28,25,0.10)] transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/church/${church.id}`} className="flex-1">
                        <h4 className="text-base font-semibold text-[#1c1c19]">
                          {church.name}
                        </h4>
                        {church.description && (
                          <p className="text-xs text-[#41484d] mt-0.5">{church.description}</p>
                        )}
                      </Link>

                      {/* 팝다운 메뉴 */}
                      <div className="relative church-menu-container">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === church.id ? null : church.id);
                          }}
                          className="ml-2 rounded-xl p-1.5 text-[#41484d] hover:bg-[#f0ede8] transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>

                        {openMenuId === church.id && (
                          <div className="absolute right-0 top-9 bg-[#ffffff] rounded-2xl py-1.5 z-10 min-w-[120px] shadow-[0px_8px_24px_rgba(28,28,25,0.12)]">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingChurch(church);
                                setShowEditModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-[#1c1c19] hover:bg-[#f6f3ee] flex items-center gap-2 transition-colors"
                            >
                              <svg className="w-4 h-4 text-[#41484d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              className="w-full px-4 py-2.5 text-left text-sm text-[#c0392b] hover:bg-[#fff4f2] flex items-center gap-2 transition-colors"
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
                        <div className="flex-1 rounded-xl bg-[#f0ede8] px-3 py-2.5 text-center">
                          <p className="text-[10px] text-[#41484d] mb-0.5">이번 주 출석</p>
                          <p className="text-lg font-bold text-[#32617d]">{stats.thisWeekAttendance}</p>
                        </div>
                        <div className="flex-1 rounded-xl bg-[#f0ede8] px-3 py-2.5 text-center">
                          <p className="text-[10px] text-[#41484d] mb-0.5">총 인원</p>
                          <p className="text-lg font-bold text-[#1c1c19]">{stats.totalStudents}</p>
                        </div>
                      </div>
                    )}

                    {/* 바로가기 버튼 */}
                    <div className="grid grid-cols-4 gap-2">
                      <Link href={`/church/${church.id}`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2.5 rounded-xl bg-[#f6f3ee] hover:bg-[#ebe8e3] transition-colors active:scale-95">
                          <svg className="w-4 h-4 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <span className="text-[9px] text-[#41484d] font-medium">출석</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/prayer`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2.5 rounded-xl bg-[#f6f3ee] hover:bg-[#ebe8e3] transition-colors active:scale-95">
                          <span className="text-sm">🙏</span>
                          <span className="text-[9px] text-[#41484d] font-medium">기도</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/calendar`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2.5 rounded-xl bg-[#f6f3ee] hover:bg-[#ebe8e3] transition-colors active:scale-95">
                          <svg className="w-4 h-4 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[9px] text-[#41484d] font-medium">일정</span>
                        </button>
                      </Link>
                      <Link href={`/church/${church.id}/offerings`}>
                        <button className="w-full flex flex-col items-center gap-1 p-2.5 rounded-xl bg-[#f6f3ee] hover:bg-[#ebe8e3] transition-colors active:scale-95">
                          <span className="text-sm">💰</span>
                          <span className="text-[9px] text-[#41484d] font-medium">헌금</span>
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
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-6" style={{ background: 'linear-gradient(to top, rgba(252,249,244,1) 70%, rgba(252,249,244,0))', backdropFilter: 'blur(8px)' }}>
        <div className="mx-auto max-w-md">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px_20px_rgba(50,97,125,0.35)' }}
          >
            새 교회 만들기
          </button>
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1c19]/40 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-[#fcf9f4] p-6 pb-10 animate-slide-up shadow-[0px_-20px_40px_rgba(28,28,25,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#c1c7cd]/50" />
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1c1c19] mb-1" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                새 교회 만들기
              </h2>
              <p className="text-sm text-[#41484d]">교회 이름과 설명을 입력해주세요</p>
            </div>

            <form onSubmit={handleCreateChurch} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">이름</label>
                <input
                  type="text"
                  value={newChurchName}
                  onChange={(e) => setNewChurchName(e.target.value)}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base font-medium text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="예: 사랑의교회 청소년부"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">설명 <span className="font-normal text-[#41484d]/50">선택</span></label>
                <textarea
                  value={newChurchDesc}
                  onChange={(e) => setNewChurchDesc(e.target.value)}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30 resize-none"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setNewChurchName(''); setNewChurchDesc(''); }}
                  className="flex-1 rounded-2xl bg-[#f0ede8] py-4 text-base font-semibold text-[#1c1c19] hover:bg-[#e5e2dd] active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl py-4 text-base font-semibold text-white active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px 20px rgba(50,97,125,0.35)' }}
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1c19]/40 backdrop-blur-sm"
          onClick={() => { setShowEditModal(false); setEditingChurch(null); }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-[#fcf9f4] p-6 pb-10 animate-slide-up shadow-[0px_-20px_40px_rgba(28,28,25,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#c1c7cd]/50" />
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1c1c19] mb-1" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                모임 수정
              </h2>
              <p className="text-sm text-[#41484d]">{editingChurch.name}</p>
            </div>

            <form onSubmit={handleEditChurch} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">이름</label>
                <input
                  type="text"
                  value={editingChurch.name}
                  onChange={(e) => setEditingChurch({...editingChurch, name: e.target.value})}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base font-medium text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="예: 사랑의교회 청소년부"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">설명 <span className="font-normal text-[#41484d]/50">선택</span></label>
                <textarea
                  value={editingChurch.description || ''}
                  onChange={(e) => setEditingChurch({...editingChurch, description: e.target.value})}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30 resize-none"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">생성일</label>
                <input
                  type="text"
                  value={new Date(editingChurch.created_at).toLocaleDateString('ko-KR')}
                  disabled
                  className="w-full rounded-xl bg-[#e5e2dd]/50 px-4 py-3.5 text-base text-[#41484d]"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingChurch(null); }}
                  className="flex-1 rounded-2xl bg-[#f0ede8] py-4 text-base font-semibold text-[#1c1c19] hover:bg-[#e5e2dd] active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl py-4 text-base font-semibold text-white active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px 20px rgba(50,97,125,0.35)' }}
                >
                  저장하기
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
