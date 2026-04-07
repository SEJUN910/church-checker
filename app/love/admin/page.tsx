'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

const PrayerEditor = lazy(() => import('./PrayerEditor'));

interface PrayerItem {
  id: string;
  title: string;
  content: string;
  author_name: string;
  category: string;
  theme_verse: string | null;
  is_visible: boolean;
  created_at: string;
}

interface Message {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

const CATEGORIES = ['농인부', '사랑부', '일반', '건강', '가족', '학업', '진로', '관계', '감사', '기타'];
const ADMIN_PASSWORD = '7332';

export default function LoveAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [tab, setTab] = useState<'prayers' | 'messages'>('prayers');

  // 기도제목
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState<PrayerItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editThemeVerse, setEditThemeVerse] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newPrayer, setNewPrayer] = useState({ title: '', content: '', author_name: '', category: '농인부', theme_verse: '' });
  const [submitting, setSubmitting] = useState(false);

  // 응원메세지
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotal, setMsgTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingMsg, setDeletingMsg] = useState<string | null>(null);

  // 비밀번호는 저장하지 않음 — 매번 입력 필요

  useEffect(() => {
    if (!isAuthenticated) return;
    loadPrayers();
    loadMessages(1);
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('비밀번호가 틀렸습니다');
      setPasswordInput('');
    }
  };

  const loadPrayers = async () => {
    setPrayerLoading(true);
    try {
      const res = await fetch('/api/love/admin/prayers', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
      if (!res.ok) throw new Error();
      setPrayers(await res.json());
    } catch {
      toast.error('기도제목 로드 실패');
    } finally {
      setPrayerLoading(false);
    }
  };

  const loadMessages = async (p: number) => {
    if (p === 1) setMsgLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/love/messages?page=${p}`);
      const json = await res.json();
      if (p === 1) setMessages(json.data || []); else setMessages(prev => [...prev, ...(json.data || [])]);
      setMsgTotal(json.total || 0);
      setMsgPage(p);
    } finally {
      setMsgLoading(false);
      setLoadingMore(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const plainText = newPrayer.content.replace(/<[^>]*>/g, '').trim();
    if (!plainText) { toast.error('내용을 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/love/admin/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify(newPrayer),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setPrayers(prev => [created, ...prev]);
      setShowAddModal(false);
      setNewPrayer({ title: '', content: '', author_name: '', category: '농인부', theme_verse: '' });
      toast.success('등록되었습니다 🙏');
    } catch {
      toast.error('등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPrayer) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/love/admin/prayers/${editingPrayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify({ content: editContent, theme_verse: editThemeVerse || null }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPrayers(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingPrayer(null);
      toast.success('수정되었습니다');
    } catch {
      toast.error('저장 실패');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePrayer = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/love/admin/prayers/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': ADMIN_PASSWORD },
      });
      if (!res.ok) throw new Error();
      setPrayers(prev => prev.filter(p => p.id !== id));
      toast.success('삭제되었습니다');
    } catch {
      toast.error('삭제 실패');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (prayer: PrayerItem) => {
    setToggling(prayer.id);
    try {
      const res = await fetch(`/api/love/admin/prayers/${prayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify({ is_visible: !prayer.is_visible }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPrayers(prev => prev.map(p => p.id === prayer.id ? updated : p));
      toast.success(updated.is_visible ? '공개됨' : '숨김 처리됨');
    } catch {
      toast.error('변경 실패');
    } finally {
      setToggling(null);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('이 응원메세지를 삭제하시겠습니까?')) return;
    setDeletingMsg(id);
    try {
      const res = await fetch(`/api/love/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': ADMIN_PASSWORD },
      });
      if (!res.ok) throw new Error();
      setMessages(prev => prev.filter(m => m.id !== id));
      setMsgTotal(prev => prev - 1);
      toast.success('삭제되었습니다');
    } catch {
      toast.error('삭제 실패');
    } finally {
      setDeletingMsg(null);
    }
  };

  // 비밀번호 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #ede9fe 100%)' }}>
        <div className="w-full max-w-sm mx-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-purple-100 text-center">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-xl font-extrabold text-purple-900 mb-1">기도제목 관리</h1>
            <p className="text-sm text-gray-500 mb-6">관리자 비밀번호를 입력해주세요</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-center text-lg tracking-widest text-gray-900 placeholder:text-gray-300 focus:border-purple-400 focus:outline-none"
                autoFocus
              />
              {authError && <p className="text-sm text-red-500 font-medium">{authError}</p>}
              <button type="submit" className="w-full rounded-2xl bg-purple-600 py-3 text-base font-bold text-white hover:bg-purple-700 active:scale-95 transition-all">
                입장하기
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/love" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← 돌아가기</Link>
            <h1 className="text-base font-bold text-gray-900">관리</h1>
          </div>
          <button onClick={() => { setIsAuthenticated(false); setPasswordInput(''); }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">
            로그아웃
          </button>
        </div>

        {/* 탭 */}
        <div className="mx-auto max-w-2xl px-5 flex gap-1 pb-0">
          {(['prayers', 'messages'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'prayers' ? `🙏 기도제목 (${prayers.length})` : `💜 응원메세지 (${msgTotal})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4">

        {/* ── 기도제목 탭 ── */}
        {tab === 'prayers' && (
          <>
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setShowAddModal(true)}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
              >
                + 기도제목 추가
              </button>
            </div>

            {prayerLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              </div>
            ) : prayers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-400">등록된 기도제목이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {prayers.map((prayer) => (
                  <div key={prayer.id} className={`rounded-2xl bg-white border p-4 ${prayer.is_visible ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${prayer.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {prayer.is_visible ? '공개' : '숨김'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(prayer.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-0.5">{prayer.title}</h3>
                        {prayer.theme_verse && (
                          <p className="text-xs text-amber-700 italic mb-1 line-clamp-1">📖 {prayer.theme_verse}</p>
                        )}
                        <p
                          className="text-xs text-gray-500 line-clamp-2 prose prose-xs max-w-none"
                          dangerouslySetInnerHTML={{ __html: prayer.content }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => { setEditingPrayer(prayer); setEditContent(prayer.content); setEditThemeVerse(prayer.theme_verse || ''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleToggle(prayer)}
                          disabled={toggling === prayer.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${prayer.is_visible ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {toggling === prayer.id ? '...' : prayer.is_visible ? '숨기기' : '공개'}
                        </button>
                        <button
                          onClick={() => handleDeletePrayer(prayer.id)}
                          disabled={deleting === prayer.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          {deleting === prayer.id ? '...' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 응원메세지 탭 ── */}
        {tab === 'messages' && (
          <>
            {msgLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <p className="text-sm text-gray-400">응원메세지가 없습니다</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-3.5">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-bold text-purple-700">
                        {msg.author_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-bold text-gray-800">{msg.author_name}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        disabled={deletingMsg === msg.id}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100"
                      >
                        {deletingMsg === msg.id ? '...' : '삭제'}
                      </button>
                    </div>
                  ))}
                </div>
                {messages.length < msgTotal && (
                  <button
                    onClick={() => loadMessages(msgPage + 1)}
                    disabled={loadingMore}
                    className="mt-4 w-full py-3 rounded-2xl border-2 border-purple-200 text-sm font-bold text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                  >
                    {loadingMore ? '불러오는 중...' : `더 보기 (${msgTotal - messages.length}개 남음)`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 기도제목 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 pb-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-extrabold text-gray-900 mb-5">기도제목 추가</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">부서 *</label>
                <div className="flex gap-2">
                  {(['농인부', '사랑부'] as const).map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setNewPrayer({ ...newPrayer, category: dept })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                        newPrayer.category === dept
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">제목 *</label>
                <input
                  type="text"
                  value={newPrayer.title}
                  onChange={(e) => setNewPrayer({ ...newPrayer, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="예: 대학 입시를 앞둔 OO를 위해"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">주제말씀 <span className="text-gray-400 font-normal">(선택)</span></label>
                <input
                  type="text"
                  value={newPrayer.theme_verse}
                  onChange={(e) => setNewPrayer({ ...newPrayer, theme_verse: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                  placeholder="예: 빌립보서 4:13 — 내게 능력 주시는 자 안에서..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">내용 *</label>
                <Suspense fallback={<div className="h-40 rounded-xl border-2 border-gray-200 flex items-center justify-center text-sm text-gray-400">에디터 로딩 중...</div>}>
                  <PrayerEditor
                    content={newPrayer.content}
                    onChange={(html) => setNewPrayer(prev => ({ ...prev, content: html }))}
                  />
                </Suspense>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50">
                  취소
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60">
                  {submitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기도제목 수정 모달 */}
      {editingPrayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-t-3xl bg-white px-2 py-4 pb-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 px-3">
              <h2 className="text-lg font-extrabold text-gray-900">기도제목 수정</h2>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">{editingPrayer.title}</p>
            </div>

            <div className="px-3 mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">주제말씀 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input
                type="text"
                value={editThemeVerse}
                onChange={(e) => setEditThemeVerse(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                placeholder="예: 빌립보서 4:13 — 내게 능력 주시는 자 안에서..."
              />
            </div>

            <Suspense fallback={<div className="h-40 rounded-xl border-2 border-gray-200 flex items-center justify-center text-sm text-gray-400">에디터 로딩 중...</div>}>
              <PrayerEditor content={editContent} onChange={setEditContent} />
            </Suspense>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setEditingPrayer(null)}
                className="flex-1 rounded-full border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {editSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
