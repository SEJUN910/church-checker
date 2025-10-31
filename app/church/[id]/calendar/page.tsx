'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ChurchEvent {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_datetime: string;
  end_datetime: string | null;
  location: string | null;
  created_by: string;
  created_at: string;
}

export default function CalendarPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;
  const supabase = createClient();

  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 새 일정 폼 상태
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'service',
    start_datetime: '',
    end_datetime: '',
    location: ''
  });

  useEffect(() => {
    loadEvents();
  }, [currentMonth]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('church_events')
        .select('*')
        .eq('church_id', churchId)
        .order('start_datetime', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('일정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = localStorage.getItem('tempUserId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('church_events')
        .insert([{
          ...newEvent,
          church_id: churchId,
          created_by: userId
        }])
        .select()
        .single();

      if (error) throw error;

      setEvents([...events, data]);
      setShowModal(false);
      setNewEvent({
        title: '',
        description: '',
        event_type: 'service',
        start_datetime: '',
        end_datetime: '',
        location: ''
      });
    } catch (error) {
      console.error('일정 생성 실패:', error);
      alert('일정을 생성하는데 실패했습니다.');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('church_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('일정 삭제 실패:', error);
      alert('일정을 삭제하는데 실패했습니다.');
    }
  };

  const getEventTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      service: '예배',
      meeting: '모임',
      retreat: '수련회',
      special: '특별행사',
      other: '기타'
    };
    return types[type] || type;
  };

  const getEventTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      service: 'bg-blue-100 text-blue-700',
      meeting: 'bg-green-100 text-green-700',
      retreat: 'bg-purple-100 text-purple-700',
      special: 'bg-red-100 text-red-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[type] || colors.other;
  };

  // 이번 달 일정 필터링
  const currentMonthEvents = events.filter(event => {
    const eventDate = new Date(event.start_datetime);
    return eventDate.getMonth() === currentMonth.getMonth() &&
           eventDate.getFullYear() === currentMonth.getFullYear();
  });

  // 다가오는 일정 (오늘부터 30일 이내)
  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.start_datetime);
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    return eventDate >= today && eventDate <= thirtyDaysLater;
  }).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/church/${churchId}`}>
                <button className="rounded-lg p-2 hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">교회 달력</h1>
                <p className="text-xs text-gray-500">일정 관리</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + 일정 추가
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 이번 달 요약 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">
            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
          </h2>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">전체 일정</p>
              <p className="text-2xl font-bold text-blue-600">{currentMonthEvents.length}</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-green-600 mb-1">다가오는</p>
              <p className="text-2xl font-bold text-green-600">{upcomingEvents.length}</p>
            </div>
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-bold text-gray-700">다가오는 일정</h3>
          {upcomingEvents.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">📅</div>
              <p className="text-sm font-bold text-gray-900 mb-1">예정된 일정이 없습니다</p>
              <p className="text-xs text-gray-500">새로운 일정을 추가해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getEventTypeColor(event.event_type)}`}>
                          {getEventTypeLabel(event.event_type)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-1">{event.title}</h4>
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {new Date(event.start_datetime).toLocaleDateString('ko-KR', {
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            {new Date(event.start_datetime).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 일정 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">새 일정 추가</h2>
              <p className="text-sm text-gray-500">일정 정보를 입력해주세요</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">제목</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 주일예배"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">일정 유형</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="service">예배</option>
                  <option value="meeting">모임</option>
                  <option value="retreat">수련회</option>
                  <option value="special">특별행사</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">시작 일시</label>
                <input
                  type="datetime-local"
                  value={newEvent.start_datetime}
                  onChange={(e) => setNewEvent({ ...newEvent, start_datetime: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">종료 일시 (선택)</label>
                <input
                  type="datetime-local"
                  value={newEvent.end_datetime}
                  onChange={(e) => setNewEvent({ ...newEvent, end_datetime: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">장소 (선택)</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 본당"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">설명 (선택)</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="간단한 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  추가
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
