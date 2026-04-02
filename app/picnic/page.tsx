'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import { FiPlus, FiChevronDown, FiUsers, FiCalendar, FiTrash2, FiArrowRight } from 'react-icons/fi';

interface Picnic {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  group_count: number;
  created_at: string;
}

interface Church { id: string; name: string; }

export default function PicnicPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading]       = useState(true);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [churches, setChurches]     = useState<Church[]>([]);
  const [churchId, setChurchId]     = useState('');
  const [picnics, setPicnics]       = useState<Picnic[]>([]);

  const [addModal, setAddModal]     = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [creating, setCreating]     = useState(false);
  const [delTarget, setDelTarget]   = useState<Picnic | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const [{ data: owned }, { data: adminMems }] = await Promise.all([
      supabase.from('churches').select('id, name').eq('owner_id', user.id),
      supabase.from('church_members').select('church_id').eq('user_id', user.id).in('role', ['admin', 'member', 'teacher']),
    ]);

    const ownedIds = (owned ?? []).map((c: Church) => c.id);
    const extraIds = (adminMems ?? []).map((m: { church_id: string }) => m.church_id).filter((id: string) => !ownedIds.includes(id));

    let churchList: Church[] = owned ?? [];
    if (extraIds.length > 0) {
      const { data: extra } = await supabase.from('churches').select('id, name').in('id', extraIds);
      churchList = [...churchList, ...(extra ?? [])];
    }

    if (churchList.length === 0) { setLoading(false); return; }
    setChurches(churchList);
    setChurchId(churchList[0].id);
    await loadPicnics(churchList[0].id);
    setLoading(false);
  }

  async function loadPicnics(cid: string) {
    const res = await fetch(`/api/picnic?church_id=${cid}`);
    if (res.ok) {
      const { picnics, isAdmin: admin } = await res.json();
      setPicnics(picnics ?? []);
      setIsAdmin(admin);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) { toast.error('제목을 입력하세요'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/picnic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId, title: newTitle.trim() }),
      });
      if (!res.ok) { toast.error((await res.json()).error ?? '생성 실패'); return; }
      const { id } = await res.json();
      router.push(`/picnic/${id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!delTarget) return;
    const res = await fetch(`/api/picnic/${delTarget.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('삭제 실패'); return; }
    toast.success('삭제되었습니다');
    setDelTarget(null);
    await loadPicnics(churchId);
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#aaa' }}>로딩 중...</div>;

  if (churches.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 10 }}>
      <div style={{ fontSize: 44 }}>🏕️</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>소속된 교회가 없습니다</div>
      <button onClick={() => router.push('/')} style={{ marginTop: 8, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>홈으로</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', paddingBottom: 80 }}>
      <Toaster />

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '16px 20px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>🏕️ 피크닉</h1>
            {churches.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <select
                  value={churchId}
                  onChange={e => { setChurchId(e.target.value); loadPicnics(e.target.value); }}
                  style={{ appearance: 'none', background: '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 28px 5px 10px', fontSize: 13, color: '#333', cursor: 'pointer' }}
                >
                  {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <FiChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#888' }}>{churches[0].name}</span>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => { setNewTitle(''); setAddModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <FiPlus size={14} /> 피크닉 추가
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 20px' }}>
        {picnics.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb', fontSize: 14 }}>
            등록된 피크닉이 없습니다.
            {isAdmin && <><br /><span style={{ color: '#1a73e8', cursor: 'pointer', marginTop: 8, display: 'inline-block' }} onClick={() => { setNewTitle(''); setAddModal(true); }}>+ 피크닉 추가하기</span></>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {picnics.map(p => (
              <div key={p.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex' }}>
                {/* Thumbnail */}
                <div
                  onClick={() => router.push(`/picnic/${p.id}`)}
                  style={{ width: 110, flexShrink: 0, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                >
                  {p.thumbnail
                    ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32 }}>🏕️</span>
                  }
                </div>
                {/* Info */}
                <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }} onClick={() => router.push(`/picnic/${p.id}`)}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>{p.title}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#999' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiCalendar size={11} />{fmtDate(p.created_at)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiUsers size={11} />{p.group_count}개 조</span>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
                  <button onClick={() => router.push(`/picnic/${p.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#333' }}>
                    보기 <FiArrowRight size={13} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => setDelTarget(p)}
                      style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: '#fff3f3', cursor: 'pointer', color: '#e53e3e', display: 'flex', alignItems: 'center' }}>
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>피크닉 추가</h2>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="피크닉 제목 입력"
              autoFocus
              style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: creating ? '#93c0f7' : '#1a73e8', color: '#fff', cursor: creating ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>피크닉 삭제</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 22, lineHeight: 1.6 }}>
              <b>"{delTarget.title}"</b>을 삭제하시겠습니까?<br />조 편성 데이터도 모두 삭제됩니다.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDelTarget(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
