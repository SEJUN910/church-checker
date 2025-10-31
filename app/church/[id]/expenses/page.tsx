'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Expense {
  id: string;
  church_id: string;
  category: string;
  item_name: string;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export default function ExpensesPage() {
  const params = useParams();
  const churchId = params.id as string;
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    category: 'snacks',
    item_name: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('church_id', churchId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('지출 기록 로드 실패:', error);
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
      if (editingExpense) {
        // 수정
        const { data, error } = await supabase
          .from('expenses')
          .update({
            category: expenseForm.category,
            item_name: expenseForm.item_name,
            amount: parseFloat(expenseForm.amount),
            expense_date: expenseForm.expense_date,
            notes: expenseForm.notes || null
          })
          .eq('id', editingExpense.id)
          .select()
          .single();

        if (error) throw error;
        setExpenses(expenses.map(e => e.id === data.id ? data : e));
      } else {
        // 신규 등록
        const { data, error } = await supabase
          .from('expenses')
          .insert([{
            ...expenseForm,
            amount: parseFloat(expenseForm.amount),
            church_id: churchId,
            created_by: userId
          }])
          .select()
          .single();

        if (error) throw error;
        setExpenses([data, ...expenses]);
      }

      setShowModal(false);
      setEditingExpense(null);
      setExpenseForm({
        category: 'snacks',
        item_name: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (error) {
      console.error('지출 기록 실패:', error);
      alert('지출을 기록하는데 실패했습니다.');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      item_name: expense.item_name,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      notes: expense.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      setExpenses(expenses.filter(e => e.id !== expenseId));
    } catch (error) {
      console.error('지출 삭제 실패:', error);
      alert('지출을 삭제하는데 실패했습니다.');
    }
  };

  const getCategoryLabel = (category: string) => {
    const categories: { [key: string]: string } = {
      snacks: '간식',
      materials: '교재/자료',
      events: '행사',
      equipment: '장비/비품',
      transportation: '교통비',
      other: '기타'
    };
    return categories[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      snacks: 'bg-orange-100 text-orange-700',
      materials: 'bg-blue-100 text-blue-700',
      events: 'bg-purple-100 text-purple-700',
      equipment: 'bg-green-100 text-green-700',
      transportation: 'bg-yellow-100 text-yellow-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[category] || colors.other;
  };

  // 이번 달 지출 통계
  const thisMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.expense_date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() &&
           expenseDate.getFullYear() === now.getFullYear();
  });

  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // 카테고리별 통계
  const categoryStats = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = 0;
    }
    acc[expense.category] += expense.amount;
    return acc;
  }, {} as { [key: string]: number });

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
                <h1 className="text-xl font-bold text-gray-900">지출 기록</h1>
                <p className="text-xs text-gray-500">부서 지출 관리</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingExpense(null);
                setExpenseForm({
                  category: 'snacks',
                  item_name: '',
                  amount: '',
                  expense_date: new Date().toISOString().split('T')[0],
                  notes: ''
                });
                setShowModal(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + 지출 추가
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-6">
        {/* 요약 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">지출 현황</h2>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-lg bg-red-50 p-3">
              <p className="text-xs text-red-600 mb-1">이번 달</p>
              <p className="text-xl font-bold text-red-600">
                {thisMonthTotal.toLocaleString()}원
              </p>
              <p className="text-xs text-red-500 mt-1">{thisMonthExpenses.length}건</p>
            </div>
            <div className="flex-1 rounded-lg bg-orange-50 p-3">
              <p className="text-xs text-orange-600 mb-1">전체</p>
              <p className="text-xl font-bold text-orange-600">
                {totalAmount.toLocaleString()}원
              </p>
              <p className="text-xs text-orange-500 mt-1">{expenses.length}건</p>
            </div>
          </div>

          {/* 카테고리별 통계 */}
          {Object.keys(categoryStats).length > 0 && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-bold text-gray-700 mb-2">카테고리별</p>
              <div className="space-y-1">
                {Object.entries(categoryStats)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{getCategoryLabel(category)}</span>
                      <span className="font-bold text-gray-900">{amount.toLocaleString()}원</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* 지출 목록 */}
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-bold text-gray-700">지출 내역</h3>
          {expenses.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mb-2 text-4xl">📝</div>
              <p className="text-sm font-bold text-gray-900 mb-1">지출 기록이 없습니다</p>
              <p className="text-xs text-gray-500">새로운 지출을 기록해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getCategoryColor(expense.category)}`}>
                          {getCategoryLabel(expense.category)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(expense.expense_date).toLocaleDateString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-1">{expense.item_name}</h4>
                      <p className="text-xl font-bold text-red-600 mb-2">
                        -{expense.amount.toLocaleString()}원
                      </p>
                      {expense.notes && (
                        <p className="text-xs text-gray-500">{expense.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
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

      {/* 지출 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                {editingExpense ? '지출 수정' : '지출 추가'}
              </h2>
              <p className="text-sm text-gray-500">지출 정보를 입력해주세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">카테고리</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="snacks">간식</option>
                  <option value="materials">교재/자료</option>
                  <option value="events">행사</option>
                  <option value="equipment">장비/비품</option>
                  <option value="transportation">교통비</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">항목</label>
                <input
                  type="text"
                  value={expenseForm.item_name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, item_name: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 수련회 간식비"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">금액</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="금액을 입력하세요"
                  required
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">날짜</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">메모 (선택)</label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="상세 내용이나 메모"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingExpense(null);
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {editingExpense ? '수정' : '추가'}
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
