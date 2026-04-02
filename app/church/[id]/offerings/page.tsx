'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Offering {
  id: string;
  church_id: string;
  student_id: string | null;
  offering_type: string;
  amount: number;
  offering_date: string;
  notes: string | null;
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

export default function OfferingsPage() {
  const params = useParams();
  const churchId = params.id as string;
  const supabase = createClient();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOffering, setEditingOffering] = useState<Offering | null>(null);

  const [offeringForm, setOfferingForm] = useState({
    offering_type: 'tithe',
    amount: '',
    offering_date: new Date().toISOString().split('T')[0],
    student_id: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 헌금 기록 로드
      const { data: offeringData, error: offeringError } = await supabase
        .from('offerings')
        .select('*')
        .eq('church_id', churchId)
        .order('offering_date', { ascending: false });

      if (offeringError) throw offeringError;

      // 학생 목록 로드
      const { data: studentData, error: studentError } = await supabase
        .from('members')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name');

      if (studentError) throw studentError;

      // 학생 정보를 헌금 기록에 매핑
      const offeringsWithStudents = await Promise.all(
        (offeringData || []).map(async (offering) => {
          if (offering.student_id) {
            const { data: student } = await supabase
              .from('members')
              .select('name')
              .eq('id', offering.student_id)
              .single();

            return { ...offering, student };
          }
          return offering;
        })
      );

      setOfferings(offeringsWithStudents);
      setStudents(studentData || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = localStorage.getItem('tempUserId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      if (editingOffering) {
        // 수정
        const { data, error } = await supabase
          .from('offerings')
          .update({
            offering_type: offeringForm.offering_type,
            amount: parseFloat(offeringForm.amount),
            offering_date: offeringForm.offering_date,
            student_id: offeringForm.student_id || null,
            notes: offeringForm.notes || null
          })
          .eq('id', editingOffering.id)
          .select()
          .single();

        if (error) throw error;

        // 학생 정보 추가
        if (data.student_id) {
          const student = students.find(s => s.id === data.student_id);
          data.student = student ? { name: student.name } : undefined;
        }

        setOfferings(offerings.map(o => o.id === data.id ? data : o));
      } else {
        // 신규 등록
        const { data, error } = await supabase
          .from('offerings')
          .insert([{
            ...offeringForm,
            amount: parseFloat(offeringForm.amount),
            church_id: churchId,
            created_by: userId,
            student_id: offeringForm.student_id || null
          }])
          .select()
          .single();

        if (error) throw error;

        // 학생 정보 추가
        if (data.student_id) {
          const student = students.find(s => s.id === data.student_id);
          data.student = student ? { name: student.name } : undefined;
        }

        setOfferings([data, ...offerings]);
      }

      setShowModal(false);
      setEditingOffering(null);
      setOfferingForm({
        offering_type: 'tithe',
        amount: '',
        offering_date: new Date().toISOString().split('T')[0],
        student_id: '',
        notes: ''
      });
    } catch (error) {
      console.error('헌금 기록 실패:', error);
      alert('헌금을 기록하는데 실패했습니다.');
    }
  };

  const handleEdit = (offering: Offering) => {
    setEditingOffering(offering);
    setOfferingForm({
      offering_type: offering.offering_type,
      amount: offering.amount.toString(),
      offering_date: offering.offering_date,
      student_id: offering.student_id || '',
      notes: offering.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (offeringId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', offeringId);

      if (error) throw error;
      setOfferings(offerings.filter(o => o.id !== offeringId));
    } catch (error) {
      console.error('헌금 삭제 실패:', error);
      alert('헌금을 삭제하는데 실패했습니다.');
    }
  };

  const getOfferingTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      tithe: '십일조',
      thanksgiving: '감사',
      mission: '선교',
      building: '건축',
      special: '특별',
      other: '기타'
    };
    return types[type] || type;
  };

  const getOfferingTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      tithe: 'bg-blue-100 text-blue-700',
      thanksgiving: 'bg-green-100 text-green-700',
      mission: 'bg-purple-100 text-purple-700',
      building: 'bg-orange-100 text-orange-700',
      special: 'bg-pink-100 text-pink-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[type] || colors.other;
  };

  // 이번 달 헌금 통계
  const thisMonthOfferings = offerings.filter(o => {
    const offeringDate = new Date(o.offering_date);
    const now = new Date();
    return offeringDate.getMonth() === now.getMonth() &&
           offeringDate.getFullYear() === now.getFullYear();
  });

  const thisMonthTotal = thisMonthOfferings.reduce((sum, o) => sum + o.amount, 0);
  const totalAmount = offerings.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="min-h-screen bg-[#fcf9f4]">
      {/* 헤더 */}
      <div className="bg-[#fcf9f4]/85 backdrop-blur-md">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/church/${churchId}`}>
                <button className="rounded-xl p-2 hover:bg-[#f0ede8]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#1c1c19]">헌금 관리</h1>
                <p className="text-xs text-[#41484d]">헌금 기록 및 관리</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingOffering(null);
                setOfferingForm({
                  offering_type: 'tithe',
                  amount: '',
                  offering_date: new Date().toISOString().split('T')[0],
                  student_id: '',
                  notes: ''
                });
                setShowModal(true);
              }}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px 20px rgba(50,97,125,0.35)' }}
            >
              + 헌금 추가
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 요약 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">헌금 현황</h2>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-blue-600 mb-1">이번 달</p>
              <p className="text-xl font-bold text-blue-600">
                {thisMonthTotal.toLocaleString()}원
              </p>
              <p className="text-xs text-blue-500 mt-1">{thisMonthOfferings.length}건</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-3">
              <p className="text-xs text-green-600 mb-1">전체</p>
              <p className="text-xl font-bold text-green-600">
                {totalAmount.toLocaleString()}원
              </p>
              <p className="text-xs text-green-500 mt-1">{offerings.length}건</p>
            </div>
          </div>
        </div>

        {/* 헌금 목록 */}
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-bold text-gray-700">헌금 기록</h3>
          {offerings.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">💰</div>
              <p className="text-sm font-bold text-gray-900 mb-1">헌금 기록이 없습니다</p>
              <p className="text-xs text-gray-500">새로운 헌금을 기록해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offerings.map((offering) => (
                <div key={offering.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getOfferingTypeColor(offering.offering_type)}`}>
                          {getOfferingTypeLabel(offering.offering_type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(offering.offering_date).toLocaleDateString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 mb-2">
                        {offering.amount.toLocaleString()}원
                      </p>
                      {offering.student && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-semibold">{offering.student.name}</span>
                        </p>
                      )}
                      {offering.notes && (
                        <p className="text-xs text-gray-500 mt-2">{offering.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleEdit(offering)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(offering.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 헌금 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                {editingOffering ? '헌금 수정' : '헌금 추가'}
              </h2>
              <p className="text-sm text-gray-500">헌금 정보를 입력해주세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">헌금 유형</label>
                <select
                  value={offeringForm.offering_type}
                  onChange={(e) => setOfferingForm({ ...offeringForm, offering_type: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="tithe">십일조</option>
                  <option value="thanksgiving">감사</option>
                  <option value="mission">선교</option>
                  <option value="building">건축</option>
                  <option value="special">특별</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">금액</label>
                <input
                  type="number"
                  value={offeringForm.amount}
                  onChange={(e) => setOfferingForm({ ...offeringForm, amount: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="금액을 입력하세요"
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">날짜</label>
                <input
                  type="date"
                  value={offeringForm.offering_date}
                  onChange={(e) => setOfferingForm({ ...offeringForm, offering_date: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">대상자 (선택)</label>
                <select
                  value={offeringForm.student_id}
                  onChange={(e) => setOfferingForm({ ...offeringForm, student_id: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">선택 안 함</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">메모 (선택)</label>
                <textarea
                  value={offeringForm.notes}
                  onChange={(e) => setOfferingForm({ ...offeringForm, notes: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="특이사항이나 메모"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingOffering(null);
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {editingOffering ? '수정' : '추가'}
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
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
