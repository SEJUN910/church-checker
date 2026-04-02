'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff,
  FiX, FiCamera, FiUser, FiChevronDown, FiSearch,
} from 'react-icons/fi';

type MemberType = 'student' | 'parent' | 'teacher' | 'other';

interface Member {
  id: string;
  type: MemberType;
  name: string;
  photo_url: string | null;
  birthdate: string | null;
  phone: string | null;
  memo: string | null;
}

interface MemberDetail extends Member {
  rrn: string | null;
}

interface Church { id: string; name: string; }

const TYPE_LABEL: Record<MemberType, string> = { student: '학생', parent: '학부모', teacher: '선생님', other: '기타' };
const TYPE_COLOR: Record<MemberType, { bg: string; text: string }> = {
  student: { bg: '#e8f0fe', text: '#1a73e8' },
  parent:  { bg: '#fef3e2', text: '#e37400' },
  teacher: { bg: '#e6f4ea', text: '#188038' },
  other:   { bg: '#f3f3f3', text: '#777777' },
};
const FILTERS = ['all', 'student', 'parent', 'teacher', 'other'] as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

export default function MemberPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]         = useState(true);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [churches, setChurches]       = useState<Church[]>([]);
  const [churchId, setChurchId]       = useState('');
  const [members, setMembers]         = useState<Member[]>([]);
  const [typeFilter, setTypeFilter]   = useState<string>('all');
  const [search, setSearch]           = useState('');

  // Modal
  const [modal, setModal]             = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing]         = useState<MemberDetail | null>(null);
  const [form, setForm]               = useState({ type: 'student' as MemberType, name: '', birthdate: '', phone: '', rrn: '', memo: '' });
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showRRN, setShowRRN]         = useState(false);
  const [saving, setSaving]           = useState(false);

  // Delete
  const [delTarget, setDelTarget]     = useState<Member | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const [{ data: owned }, { data: adminMems }] = await Promise.all([
      supabase.from('churches').select('id, name').eq('owner_id', user.id),
      supabase.from('church_members').select('church_id').eq('user_id', user.id).eq('role', 'admin'),
    ]);

    const ownedIds = (owned ?? []).map((c: Church) => c.id);
    const adminIds = (adminMems ?? []).map((m: { church_id: string }) => m.church_id);
    const extraIds = adminIds.filter((id: string) => !ownedIds.includes(id));

    let churchList: Church[] = owned ?? [];
    if (extraIds.length > 0) {
      const { data: extra } = await supabase.from('churches').select('id, name').in('id', extraIds);
      churchList = [...churchList, ...(extra ?? [])];
    }

    if (churchList.length === 0) { setLoading(false); return; }

    setChurches(churchList);
    setIsAdmin(true);
    setChurchId(churchList[0].id);
    await loadMembers(churchList[0].id);
    setLoading(false);
  }

  async function loadMembers(cid: string) {
    const res = await fetch(`/api/member?church_id=${cid}`);
    if (res.ok) setMembers((await res.json()).members ?? []);
  }

  async function openEdit(m: Member) {
    const res = await fetch(`/api/member/${m.id}`);
    if (!res.ok) { toast.error('불러오기 실패'); return; }
    const { member } = (await res.json()) as { member: MemberDetail };
    setEditing(member);
    setForm({ type: member.type, name: member.name, birthdate: member.birthdate ?? '', phone: member.phone ?? '', rrn: member.rrn ?? '', memo: member.memo ?? '' });
    setPhotoFile(null);
    setPhotoPreview(member.photo_url);
    setShowRRN(false);
    setModal('edit');
  }

  function openAdd() {
    setEditing(null);
    setForm({ type: 'student', name: '', birthdate: '', phone: '', rrn: '', memo: '' });
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowRRN(false);
    setModal('add');
  }

  async function uploadPhoto(file: File, memberId: string): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `${churchId}/${memberId}.${ext}`;
    await supabase.storage.from('member-photos').remove([path]);
    const { error } = await supabase.storage.from('member-photos').upload(path, file, { upsert: true });
    if (error) return null;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/member-photos/${path}`;
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('이름을 입력하세요'); return; }
    setSaving(true);
    try {
      if (modal === 'add') {
        const body = { church_id: churchId, type: form.type, name: form.name.trim(), birthdate: form.birthdate || null, phone: form.phone || null, rrn: form.rrn || null, memo: form.memo || null };
        const res = await fetch('/api/member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error((await res.json()).error ?? '저장 실패'); return; }
        const { id } = await res.json();
        if (photoFile) {
          const url = await uploadPhoto(photoFile, id);
          if (url) await fetch(`/api/member/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: url }) });
        }
        toast.success('등록되었습니다');
      } else {
        const id = editing!.id;
        const body: Record<string, unknown> = { type: form.type, name: form.name.trim(), birthdate: form.birthdate || null, phone: form.phone || null, rrn: form.rrn, memo: form.memo || null };
        if (photoFile) body.photo_url = await uploadPhoto(photoFile, id);
        const res = await fetch(`/api/member/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error((await res.json()).error ?? '수정 실패'); return; }
        toast.success('수정되었습니다');
      }
      setModal(null);
      await loadMembers(churchId);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!delTarget) return;
    const res = await fetch(`/api/member/${delTarget.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('삭제 실패'); return; }
    toast.success('삭제되었습니다');
    setDelTarget(null);
    await loadMembers(churchId);
  }

  const counts = { all: members.length, student: 0, parent: 0, teacher: 0, other: 0 } as Record<string, number>;
  members.forEach(m => { if (counts[m.type] !== undefined) counts[m.type]++; });
  const filtered = members.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) &&
    (!search || m.name.includes(search))
  );

  /* ─── Loading ───────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ color: '#aaa', fontSize: 15 }}>로딩 중...</div>
    </div>
  );

  /* ─── No admin churches ──────────────────────────────────── */
  if (churches.length === 0) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 44 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#222' }}>관리자 권한이 없습니다</div>
      <div style={{ fontSize: 13, color: '#888', textAlign: 'center' }}>교회 소유자 또는 admin 권한이 있어야<br />멤버 관리 페이지에 접근할 수 있습니다.</div>
      <button onClick={() => router.push('/')} style={{ marginTop: 8, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>홈으로</button>
    </div>
  );

  /* ─── Main ───────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', paddingBottom: 80 }}>
      <Toaster />

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '16px 20px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>멤버 관리</h1>
            {churches.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <select
                  value={churchId}
                  onChange={e => { const cid = e.target.value; setChurchId(cid); setTypeFilter('all'); setSearch(''); loadMembers(cid); }}
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
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <FiPlus size={14} /> 멤버 추가
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 20px 0' }}>
        {/* Filter + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {FILTERS.map(t => (
            <button key={t}
              onClick={() => { setTypeFilter(t); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: typeFilter === t ? 700 : 400, background: typeFilter === t ? '#1a73e8' : '#fff', color: typeFilter === t ? '#fff' : '#555', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'all 0.15s' }}
            >
              {t === 'all' ? '전체' : TYPE_LABEL[t as MemberType]}
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.75 }}>{counts[t]}</span>
            </button>
          ))}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <FiSearch size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
            <input
              placeholder="이름 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', background: '#fff', width: 140 }}
            />
          </div>
        </div>

        {/* Member grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 0', color: '#bbb', fontSize: 14 }}>
            {members.length === 0 ? (
              <>등록된 멤버가 없습니다.<br /><span style={{ cursor: 'pointer', color: '#1a73e8', marginTop: 8, display: 'inline-block' }} onClick={openAdd}>+ 멤버 추가하기</span></>
            ) : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {filtered.map(m => (
              <div key={m.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Photo */}
                <div
                  onClick={() => openEdit(m)}
                  style={{ width: '100%', aspectRatio: '1', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}
                >
                  {m.photo_url
                    ? <img src={m.photo_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <FiUser size={36} color="#d0d0d0" />
                  }
                </div>
                {/* Info */}
                <div onClick={() => openEdit(m)} style={{ padding: '10px 12px 8px', cursor: 'pointer', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>{m.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: TYPE_COLOR[m.type].bg, color: TYPE_COLOR[m.type].text, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {TYPE_LABEL[m.type]}
                    </span>
                  </div>
                  {m.birthdate && <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{m.birthdate}</div>}
                  {m.phone && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{m.phone}</div>}
                  {m.memo && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.memo}</div>}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', borderTop: '1px solid #f0f0f0' }}>
                  <button onClick={() => openEdit(m)} style={{ flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <FiEdit2 size={11} /> 수정
                  </button>
                  <button onClick={() => setDelTarget(m)} style={{ flex: 1, padding: '8px 0', border: 'none', borderLeft: '1px solid #f0f0f0', background: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <FiTrash2 size={11} /> 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Add/Edit Modal ──────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{modal === 'add' ? '멤버 추가' : '멤버 수정'}</h2>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <FiX size={20} color="#555" />
              </button>
            </div>

            <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Photo */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: 100, height: 100, borderRadius: '50%', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed #ddd' }}
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center' }}><FiCamera size={22} color="#c0c0c0" /><div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>사진</div></div>
                  }
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
              </div>

              {/* Type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>구분 *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['student', 'parent', 'teacher', 'other'] as MemberType[]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: form.type === t ? 'none' : '1px solid #e0e0e0', cursor: 'pointer', fontSize: 13, fontWeight: form.type === t ? 700 : 400, background: form.type === t ? TYPE_COLOR[t].bg : '#fff', color: form.type === t ? TYPE_COLOR[t].text : '#555', transition: 'all 0.15s' }}
                    >{TYPE_LABEL[t]}</button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>이름 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="이름 입력" style={inp} />
              </div>

              {/* Birthdate */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>생년월일</label>
                <input type="date" value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} style={inp} />
              </div>

              {/* Phone */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>연락처</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" style={inp} />
              </div>

              {/* RRN — admin only */}
              {isAdmin && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    주민등록번호
                    <span style={{ fontSize: 10, color: '#e37400', background: '#fef3e2', padding: '1px 6px', borderRadius: 6 }}>🔒 관리자 전용</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRRN ? 'text' : 'password'}
                      value={form.rrn}
                      onChange={e => setForm(f => ({ ...f, rrn: e.target.value }))}
                      placeholder="000000-0000000"
                      style={{ ...inp, paddingRight: 40 }}
                    />
                    <button onClick={() => setShowRRN(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showRRN ? <FiEyeOff size={16} color="#999" /> : <FiEye size={16} color="#999" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Memo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모 입력" rows={3}
                  style={{ ...inp, resize: 'none' }} />
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '12px 0', borderRadius: 10, border: 'none', background: saving ? '#93c0f7' : '#1a73e8', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ──────────────────────────────────── */}
      {delTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{delTarget.name} 삭제</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 22, lineHeight: 1.6 }}>이 멤버를 삭제하시겠습니까?<br />삭제 후 복구할 수 없습니다.</div>
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
