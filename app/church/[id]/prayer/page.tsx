'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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
  student?: {
    name: string;
  };
}

interface Student {
  id: string;
  name: string;
}

export default function PrayerPage() {
  const params = useParams();
  const churchId = params.id as string;
  const supabase = createClient();

  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTestimonyModal, setShowTestimonyModal] = useState(false);
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerRequest | null>(null);
  const [testimony, setTestimony] = useState('');

  const [newPrayer, setNewPrayer] = useState({
    title: '',
    content: '',
    is_anonymous: false,
    student_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 기도제목 로드
      const { data: prayerData, error: prayerError } = await supabase
        .from('prayer_requests')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (prayerError) throw prayerError;

      // 학생 목록 로드
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name');

      if (studentError) throw studentError;

      // 학생 정보를 기도제목에 매핑
      const prayersWithStudents = await Promise.all(
        (prayerData || []).map(async (prayer) => {
          if (prayer.student_id && !prayer.is_anonymous) {
            const { data: student } = await supabase
              .from('students')
              .select('name')
              .eq('id', prayer.student_id)
              .single();

            return { ...prayer, student };
          }
          return prayer;
        })
      );

      setPrayers(prayersWithStudents);
      setStudents(studentData || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrayer = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = localStorage.getItem('tempUserId');
    if (!userId) {
      alert('로그인이 필요합니다.');
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

      setPrayers([data, ...prayers]);
      setShowModal(false);
      setNewPrayer({
        title: '',
        content: '',
        is_anonymous: false,
        student_id: ''
      });
    } catch (error) {
      console.error('기도제목 생성 실패:', error);
      alert('기도제목을 등록하는데 실패했습니다.');
    }
  };

  const handleMarkAsAnswered = async () => {
    if (!selectedPrayer || !testimony.trim()) return;

    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .update({
          is_answered: true,
          answer_testimony: testimony,
          answered_at: new Date().toISOString()
        })
        .eq('id', selectedPrayer.id)
        .select()
        .single();

      if (error) throw error;

      setPrayers(prayers.map(p => p.id === data.id ? { ...p, ...data } : p));
      setShowTestimonyModal(false);
      setSelectedPrayer(null);
      setTestimony('');
    } catch (error) {
      console.error('응답 등록 실패:', error);
      alert('응답을 등록하는데 실패했습니다.');
    }
  };

  const handleDeletePrayer = async (prayerId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .delete()
        .eq('id', prayerId);

      if (error) throw error;
      setPrayers(prayers.filter(p => p.id !== prayerId));
    } catch (error) {
      console.error('기도제목 삭제 실패:', error);
      alert('기도제목을 삭제하는데 실패했습니다.');
    }
  };

  const unansweredPrayers = prayers.filter(p => !p.is_answered);
  const answeredPrayers = prayers.filter(p => p.is_answered);

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
                <h1 className="text-xl font-bold text-gray-900">기도제목</h1>
                <p className="text-xs text-gray-500">함께 기도해요</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + 기도제목
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 요약 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">기도 현황</h2>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">기도중</p>
              <p className="text-2xl font-bold text-blue-600">{unansweredPrayers.length}</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-green-600 mb-1">응답됨</p>
              <p className="text-2xl font-bold text-green-600">{answeredPrayers.length}</p>
            </div>
            <div className="flex-1 rounded-lg bg-purple-50 p-3 text-center">
              <p className="text-xs text-purple-600 mb-1">전체</p>
              <p className="text-2xl font-bold text-purple-600">{prayers.length}</p>
            </div>
          </div>
        </div>

        {/* 기도중인 제목 */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-bold text-gray-700 flex items-center gap-2">
            🙏 기도중인 제목
          </h3>
          {unansweredPrayers.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">🙏</div>
              <p className="text-sm font-bold text-gray-900 mb-1">기도제목이 없습니다</p>
              <p className="text-xs text-gray-500">새로운 기도제목을 등록해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unansweredPrayers.map((prayer) => (
                <div key={prayer.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {prayer.is_anonymous ? (
                          <span className="text-xs font-bold text-gray-500">익명</span>
                        ) : prayer.student ? (
                          <span className="text-xs font-bold text-blue-600">{prayer.student.name}</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-500">작성자</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(prayer.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">{prayer.title}</h4>
                      <p className="text-sm text-gray-600 mb-3">{prayer.content}</p>
                      <button
                        onClick={() => {
                          setSelectedPrayer(prayer);
                          setShowTestimonyModal(true);
                        }}
                        className="text-xs font-bold text-green-600 hover:text-green-700"
                      >
                        ✓ 응답됨으로 표시
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeletePrayer(prayer.id)}
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

        {/* 응답된 기도 */}
        {answeredPrayers.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-3 text-sm font-bold text-gray-700 flex items-center gap-2">
              ✨ 응답된 기도
            </h3>
            <div className="space-y-3">
              {answeredPrayers.map((prayer) => (
                <div key={prayer.id} className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                          응답됨
                        </span>
                        {prayer.is_anonymous ? (
                          <span className="text-xs font-bold text-gray-500">익명</span>
                        ) : prayer.student ? (
                          <span className="text-xs font-bold text-green-700">{prayer.student.name}</span>
                        ) : null}
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">{prayer.title}</h4>
                      <p className="text-sm text-gray-600 mb-3">{prayer.content}</p>
                      {prayer.answer_testimony && (
                        <div className="rounded-lg bg-white p-3 border border-green-200">
                          <p className="text-xs font-bold text-green-700 mb-1">감사 간증</p>
                          <p className="text-sm text-gray-700">{prayer.answer_testimony}</p>
                          {prayer.answered_at && (
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(prayer.answered_at).toLocaleDateString('ko-KR')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeletePrayer(prayer.id)}
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
          </div>
        )}
      </div>

      {/* 기도제목 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
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
                  onClick={() => setShowModal(false)}
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

      {/* 응답 간증 모달 */}
      {showTestimonyModal && selectedPrayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">응답 간증</h2>
              <p className="text-sm text-gray-500">하나님께서 어떻게 응답하셨나요?</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-900 mb-1">{selectedPrayer.title}</p>
                <p className="text-xs text-gray-600">{selectedPrayer.content}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">감사 간증</label>
                <textarea
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none resize-none"
                  placeholder="하나님께서 어떻게 응답하셨는지 나누어주세요"
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestimonyModal(false);
                    setSelectedPrayer(null);
                    setTestimony('');
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleMarkAsAnswered}
                  className="flex-1 rounded-full bg-green-600 py-3.5 text-base font-bold text-white hover:bg-green-700 active:scale-95 transition-all"
                >
                  응답됨
                </button>
              </div>
            </div>
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
