'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ServiceSchedule {
  id: string;
  church_id: string;
  service_type: string;
  service_name: string;
  assigned_student_id: string | null;
  schedule_date: string;
  notes: string | null;
  status: string;
  student?: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

export default function ServiceSchedulePage() {
  const params = useParams();
  const churchId = params.id as string;
  const supabase = createClient();

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [newSchedule, setNewSchedule] = useState({
    service_type: 'worship',
    service_name: '찬양 인도',
    assigned_student_id: '',
    schedule_date: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 봉사 스케줄 로드
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('service_schedules')
        .select('*')
        .eq('church_id', churchId)
        .order('schedule_date', { ascending: true });

      if (scheduleError) throw scheduleError;

      // 학생 목록 로드
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name');

      if (studentError) throw studentError;

      // 학생 정보를 스케줄에 매핑
      const schedulesWithStudents = await Promise.all(
        (scheduleData || []).map(async (schedule) => {
          if (schedule.assigned_student_id) {
            const { data: student } = await supabase
              .from('students')
              .select('name')
              .eq('id', schedule.assigned_student_id)
              .single();

            return { ...schedule, student };
          }
          return schedule;
        })
      );

      setSchedules(schedulesWithStudents);
      setStudents(studentData || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('service_schedules')
        .insert([{
          ...newSchedule,
          church_id: churchId,
          assigned_student_id: newSchedule.assigned_student_id || null
        }])
        .select()
        .single();

      if (error) throw error;

      // 학생 정보 추가
      if (data.assigned_student_id) {
        const student = students.find(s => s.id === data.assigned_student_id);
        data.student = student ? { name: student.name } : undefined;
      }

      setSchedules([...schedules, data]);
      setShowModal(false);
      setNewSchedule({
        service_type: 'worship',
        service_name: '찬양 인도',
        assigned_student_id: '',
        schedule_date: '',
        notes: ''
      });
    } catch (error) {
      console.error('봉사 스케줄 생성 실패:', error);
      alert('봉사 스케줄을 생성하는데 실패했습니다.');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('service_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      setSchedules(schedules.filter(s => s.id !== scheduleId));
    } catch (error) {
      console.error('봉사 스케줄 삭제 실패:', error);
      alert('봉사 스케줄을 삭제하는데 실패했습니다.');
    }
  };

  const getServiceTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      worship: '찬양',
      prayer: '기도',
      word: '말씀',
      accompanist: '반주',
      media: '영상/음향',
      other: '기타'
    };
    return types[type] || type;
  };

  const getServiceTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      worship: 'bg-purple-100 text-purple-700',
      prayer: 'bg-blue-100 text-blue-700',
      word: 'bg-green-100 text-green-700',
      accompanist: 'bg-pink-100 text-pink-700',
      media: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[type] || colors.other;
  };

  const getStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      scheduled: '예정',
      completed: '완료',
      cancelled: '취소',
      replacement_needed: '대타 필요'
    };
    return statuses[status] || status;
  };

  // 이번 달 스케줄
  const thisMonthSchedules = schedules.filter(s => {
    const scheduleDate = new Date(s.schedule_date);
    const now = new Date();
    return scheduleDate.getMonth() === now.getMonth() &&
           scheduleDate.getFullYear() === now.getFullYear();
  });

  // 다가오는 스케줄 (오늘부터 30일 이내)
  const upcomingSchedules = schedules.filter(s => {
    const scheduleDate = new Date(s.schedule_date);
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    return scheduleDate >= today && scheduleDate <= thirtyDaysLater;
  }).slice(0, 10);

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
                <h1 className="text-xl font-bold text-gray-900">봉사 스케줄</h1>
                <p className="text-xs text-gray-500">봉사자 배정 관리</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + 스케줄 추가
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 요약 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">이번 달 봉사</h2>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">전체</p>
              <p className="text-2xl font-bold text-blue-600">{thisMonthSchedules.length}</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-green-600 mb-1">예정</p>
              <p className="text-2xl font-bold text-green-600">
                {thisMonthSchedules.filter(s => s.status === 'scheduled').length}
              </p>
            </div>
            <div className="flex-1 rounded-lg bg-purple-50 p-3 text-center">
              <p className="text-xs text-purple-600 mb-1">완료</p>
              <p className="text-2xl font-bold text-purple-600">
                {thisMonthSchedules.filter(s => s.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        {/* 다가오는 봉사 스케줄 */}
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-bold text-gray-700">다가오는 봉사</h3>
          {upcomingSchedules.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">📋</div>
              <p className="text-sm font-bold text-gray-900 mb-1">예정된 봉사가 없습니다</p>
              <p className="text-xs text-gray-500">새로운 봉사 스케줄을 추가해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getServiceTypeColor(schedule.service_type)}`}>
                          {getServiceTypeLabel(schedule.service_type)}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {getStatusLabel(schedule.status)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-1">{schedule.service_name}</h4>
                      {schedule.student && (
                        <p className="text-sm text-gray-600 mb-2">담당: {schedule.student.name}</p>
                      )}
                      {!schedule.student && (
                        <p className="text-sm text-red-600 mb-2">담당자 미배정</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {new Date(schedule.schedule_date).toLocaleDateString('ko-KR', {
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </span>
                        </div>
                      </div>
                      {schedule.notes && (
                        <p className="text-xs text-gray-500 mt-2">메모: {schedule.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
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

      {/* 스케줄 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">봉사 스케줄 추가</h2>
              <p className="text-sm text-gray-500">봉사 정보를 입력해주세요</p>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">봉사 유형</label>
                <select
                  value={newSchedule.service_type}
                  onChange={(e) => setNewSchedule({ ...newSchedule, service_type: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="worship">찬양</option>
                  <option value="prayer">기도</option>
                  <option value="word">말씀</option>
                  <option value="accompanist">반주</option>
                  <option value="media">영상/음향</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">봉사 이름</label>
                <input
                  type="text"
                  value={newSchedule.service_name}
                  onChange={(e) => setNewSchedule({ ...newSchedule, service_name: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 찬양 인도"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">담당자</label>
                <select
                  value={newSchedule.assigned_student_id}
                  onChange={(e) => setNewSchedule({ ...newSchedule, assigned_student_id: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">선택 안 함</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">날짜</label>
                <input
                  type="date"
                  value={newSchedule.schedule_date}
                  onChange={(e) => setNewSchedule({ ...newSchedule, schedule_date: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">메모 (선택)</label>
                <textarea
                  value={newSchedule.notes}
                  onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="특이사항이나 준비물 등"
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
