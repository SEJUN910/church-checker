'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { ImageResize } from 'tiptap-extension-resize-image';
import TextAlign from '@tiptap/extension-text-align';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiArrowLeft, FiEdit2, FiCheck, FiX, FiPlus, FiTrash2,
  FiUser, FiPhone, FiFileText, FiImage, FiBold, FiItalic,
  FiList, FiAlignLeft, FiAlignCenter, FiAlignRight,
} from 'react-icons/fi';

type MemberType = 'student' | 'parent' | 'teacher' | 'other';
const TYPE_LABEL: Record<MemberType, string> = { student: '학생', parent: '학부모', teacher: '선생님', other: '기타' };
const TYPE_COLOR: Record<MemberType, { bg: string; text: string }> = {
  student: { bg: '#e8f0fe', text: '#1a73e8' },
  parent:  { bg: '#fef3e2', text: '#e37400' },
  teacher: { bg: '#e6f4ea', text: '#188038' },
  other:   { bg: '#f3f3f3', text: '#777777' },
};

interface Member      { id: string; name: string; photo_url: string | null; phone: string | null; memo: string | null; type: MemberType; }
interface Group       { id: string; name: string; members: Member[]; }
interface Picnic      { id: string; title: string; description: string | null; church_id: string; images: unknown[]; groups: Group[]; isAdmin: boolean; }
interface ChurchMember{ id: string; name: string; type: MemberType; photo_url: string | null; }

export default function PicnicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const supabase = createClient();
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]   = useState(true);
  const [picnic, setPicnic]     = useState<Picnic | null>(null);
  const [tab, setTab]           = useState<'guide' | 'groups'>('guide');

  // Title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft]     = useState('');

  // Description edit
  const [savingDesc, setSavingDesc]   = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Real-time preview
  const [previewHtml, setPreviewHtml] = useState('');

  // Group modals
  const [groupModal, setGroupModal] = useState<null | { mode: 'add' | 'rename'; groupId?: string }>(null);
  const [groupName, setGroupName]   = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [delGroup, setDelGroup]     = useState<Group | null>(null);

  // Member picker
  const [pickerGroup, setPickerGroup]   = useState<Group | null>(null);
  const [allMembers, setAllMembers]     = useState<ChurchMember[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers]   = useState(false);

  // Member detail popup
  const [memberDetail, setMemberDetail] = useState<Member | null>(null);

  // Tiptap editor — 처음부터 editable
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ImageResize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    editable: true,
    immediatelyRender: false,
  });

  useEffect(() => { load(); }, [id]);

  // Sync editor content → real-time preview
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setPreviewHtml(editor.getHTML());
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/picnic/${id}`);
    if (!res.ok) { toast.error('불러오기 실패'); router.push('/picnic'); return; }
    const { picnic: data } = await res.json() as { picnic: Picnic };
    setPicnic(data);
    setPreviewHtml(data.description ?? '');
    setLoading(false);
  }

  // picnic 로드 완료 + editor 준비 → content 세팅
  useEffect(() => {
    if (!editor || !picnic) return;
    editor.commands.setContent(picnic.description ?? '');
    setPreviewHtml(picnic.description ?? '');
  }, [picnic?.id, editor]);

  // ─── Title ──────────────────────────────────────────────
  async function saveTitle() {
    if (!titleDraft.trim()) return;
    const res = await fetch(`/api/picnic/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: titleDraft.trim() }) });
    if (!res.ok) { toast.error('저장 실패'); return; }
    setPicnic(p => p ? { ...p, title: titleDraft.trim() } : p);
    setEditingTitle(false);
    toast.success('제목 저장됨');
  }

  // ─── Description ────────────────────────────────────────
  async function saveDesc() {
    if (!editor) return;
    setSavingDesc(true);
    const html = editor.getHTML();
    const res = await fetch(`/api/picnic/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: html }) });
    if (!res.ok) { toast.error('저장 실패'); setSavingDesc(false); return; }
    setPicnic(p => p ? { ...p, description: html } : p);
    setSavingDesc(false);
    toast.success('저장됨');
  }

  // ─── Image upload into editor ────────────────────────────
  async function handleEditorImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('picnic-images').upload(path, file, { upsert: false });
      if (error) { toast.error('이미지 업로드 실패'); return; }
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/picnic-images/${path}`;
      editor.chain().focus().insertContent({ type: 'image', attrs: { src: url } }).run();
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  }

  // ─── Groups ─────────────────────────────────────────────
  async function handleGroupSave() {
    if (!groupName.trim()) { toast.error('조 이름을 입력하세요'); return; }
    setSavingGroup(true);
    try {
      if (groupModal?.mode === 'add') {
        const res = await fetch(`/api/picnic/${id}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName.trim() }) });
        if (!res.ok) { toast.error('추가 실패'); return; }
        const { id: gid } = await res.json();
        setPicnic(p => p ? { ...p, groups: [...p.groups, { id: gid, name: groupName.trim(), members: [] }] } : p);
        toast.success('조 추가됨');
      } else {
        const gid = groupModal!.groupId!;
        const res = await fetch(`/api/picnic/${id}/groups/${gid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName.trim() }) });
        if (!res.ok) { toast.error('수정 실패'); return; }
        setPicnic(p => p ? { ...p, groups: p.groups.map(g => g.id === gid ? { ...g, name: groupName.trim() } : g) } : p);
        toast.success('조 이름 수정됨');
      }
      setGroupModal(null);
    } finally { setSavingGroup(false); }
  }

  async function handleGroupDelete() {
    if (!delGroup) return;
    const res = await fetch(`/api/picnic/${id}/groups/${delGroup.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('삭제 실패'); return; }
    setPicnic(p => p ? { ...p, groups: p.groups.filter(g => g.id !== delGroup.id) } : p);
    toast.success('조 삭제됨');
    setDelGroup(null);
  }

  // ─── Member picker ──────────────────────────────────────
  async function openMemberPicker(group: Group) {
    setPickerGroup(group);
    setPickerSearch('');
    setPickerSelected(new Set());
    if (picnic && allMembers.length === 0) {
      const res = await fetch(`/api/member?church_id=${picnic.church_id}`);
      if (res.ok) setAllMembers((await res.json()).members ?? []);
    }
  }

  async function handleAddMembers() {
    if (!pickerGroup || pickerSelected.size === 0) return;
    setAddingMembers(true);
    try {
      const res = await fetch(`/api/picnic/${id}/groups/${pickerGroup.id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: Array.from(pickerSelected) }),
      });
      if (!res.ok) { toast.error('추가 실패'); return; }
      const newMembers = allMembers.filter(m => pickerSelected.has(m.id) && !pickerGroup.members.find(gm => gm.id === m.id)) as Member[];
      setPicnic(p => p ? { ...p, groups: p.groups.map(g => g.id === pickerGroup.id ? { ...g, members: [...g.members, ...newMembers] } : g) } : p);
      toast.success(`${newMembers.length}명 추가됨`);
      setPickerGroup(null);
    } finally { setAddingMembers(false); }
  }

  async function removeMember(groupId: string, memberId: string) {
    const res = await fetch(`/api/picnic/${id}/groups/${groupId}/members?member_id=${memberId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('제거 실패'); return; }
    setPicnic(p => p ? { ...p, groups: p.groups.map(g => g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g) } : p);
  }

  // ─── Alignment helpers ──────────────────────────────────
  const WRAP_STYLES = {
    left:   'display: block; float: left;  margin: 0 16px 8px 0;',
    center: 'display: flex;  justify-content: center; clear: both;',
    right:  'display: block; float: right; margin: 0 0 8px 16px;',
  };

  function setAlign(align: 'left' | 'center' | 'right') {
    if (!editor) return;
    if (editor.isActive('imageResize')) {
      editor.chain().focus().updateAttributes('imageResize', { wrapperStyle: WRAP_STYLES[align] }).run();
    } else {
      editor.chain().focus().setTextAlign(align).run();
    }
  }

  function isAlignActive(align: 'left' | 'center' | 'right') {
    if (!editor) return false;
    if (editor.isActive('imageResize')) {
      const ws: string = editor.getAttributes('imageResize').wrapperStyle ?? '';
      if (align === 'left')   return ws.includes('float: left');
      if (align === 'right')  return ws.includes('float: right');
      if (align === 'center') return ws.includes('justify-content: center');
    }
    return editor.isActive({ textAlign: align });
  }

  // ─── Render ─────────────────────────────────────────────
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#aaa' }}>로딩 중...</div>;
  if (!picnic) return null;

  const inGroupIds     = new Set(pickerGroup?.members.map(m => m.id) ?? []);
  const pickerFiltered = allMembers.filter(m => !inGroupIds.has(m.id) && (!pickerSearch || m.name.includes(pickerSearch)));

  // Toolbar button helper
  const TBtn = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button title={title} onClick={onClick}
      style={{ padding: '5px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? '#1a73e8' : '#f0f0f0', color: active ? '#fff' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', paddingBottom: 60 }}>
      <Toaster />
      <style>{`
        .tiptap-editor { outline: none; min-height: 300px; font-size: 14px; line-height: 1.7; color: #222; overflow: hidden; }
        .tiptap-editor p { margin: 0 0 8px; min-height: 1.4em; }
        .tiptap-editor p[style*="text-align: center"] { text-align: center; }
        .tiptap-editor p[style*="text-align: right"]  { text-align: right; }
        .tiptap-editor img { max-width: 100%; border-radius: 8px; }
        .tiptap-editor ul, .tiptap-editor ol { padding-left: 20px; margin: 6px 0; }
        .tiptap-editor::after { content: ''; display: table; clear: both; }
        .phone-content p { margin: 0 0 6px; font-size: 13px; line-height: 1.6; min-height: 1.2em; }
        .phone-content p[style*="text-align: center"] { text-align: center; }
        .phone-content p[style*="text-align: right"]  { text-align: right; }
        .phone-content img { max-width: 100%; border-radius: 6px; margin: 4px 0; }
        .phone-content ul, .phone-content ol { padding-left: 16px; margin: 4px 0; font-size: 13px; }
        .phone-content::after { content: ''; display: table; clear: both; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '14px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => router.push(`/picnic/${id}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <FiArrowLeft size={18} color="#555" />
            </button>
            {editingTitle ? (
              <div style={{ display: 'flex', flex: 1, gap: 8, alignItems: 'center' }}>
                <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTitle()}
                  autoFocus style={{ flex: 1, fontSize: 18, fontWeight: 700, border: 'none', borderBottom: '2px solid #1a73e8', outline: 'none', background: 'transparent', padding: '2px 0' }} />
                <button onClick={saveTitle} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', display: 'flex' }}><FiCheck size={18} /></button>
                <button onClick={() => setEditingTitle(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}><FiX size={18} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111', flex: 1 }}>{picnic.title}</h1>
                {picnic.isAdmin && (
                  <button onClick={() => { setTitleDraft(picnic.title); setEditingTitle(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <FiEdit2 size={15} color="#999" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex' }}>
            {(['guide', 'groups'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 700 : 400, color: tab === t ? '#1a73e8' : '#888', borderBottom: tab === t ? '2px solid #1a73e8' : '2px solid transparent', transition: 'all 0.15s' }}>
                {t === 'guide' ? '📋 안내' : '👥 조편성'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

        {/* ─── 안내 탭 ─── */}
        {tab === 'guide' && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

            {/* Left: Editor */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                {/* Toolbar */}
                {picnic.isAdmin && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', background: '#fafafa' }}>
                    <TBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="굵게"><FiBold size={14} /></TBtn>
                    <TBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="기울임"><FiItalic size={14} /></TBtn>
                    <TBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="밑줄">
                      <span style={{ fontSize: 13, textDecoration: 'underline', fontWeight: 600 }}>U</span>
                    </TBtn>
                    <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
                    <TBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="목록"><FiList size={14} /></TBtn>
                    <TBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="번호 목록">
                      <span style={{ fontSize: 11, fontWeight: 700 }}>1.</span>
                    </TBtn>
                    <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
                    <TBtn onClick={() => imgInputRef.current?.click()} title="이미지 삽입">
                      <FiImage size={14} color={uploadingImg ? '#aaa' : '#333'} />
                    </TBtn>
                    <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditorImageUpload} />
                    <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
                    <TBtn onClick={() => setAlign('left')}   active={isAlignActive('left')}   title="왼쪽 정렬"><FiAlignLeft   size={14} /></TBtn>
                    <TBtn onClick={() => setAlign('center')} active={isAlignActive('center')} title="가운데 정렬"><FiAlignCenter size={14} /></TBtn>
                    <TBtn onClick={() => setAlign('right')}  active={isAlignActive('right')}  title="오른쪽 정렬"><FiAlignRight  size={14} /></TBtn>
                    <div style={{ flex: 1 }} />
                    <button onClick={saveDesc} disabled={savingDesc}
                      style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: savingDesc ? '#93c0f7' : '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {savingDesc ? '저장 중...' : '저장'}
                    </button>
                  </div>
                )}

                {/* Editor area */}
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: '14px 16px', minHeight: 400, cursor: 'text', background: '#fff' }}
                    onClick={() => editor?.commands.focus()}>
                    {editor ? (
                      <EditorContent editor={editor} className="tiptap-editor" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Phone preview */}
            <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 24 }}>
              <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase' }}>미리보기</div>

              {/* Phone frame */}
              <div style={{ margin: '0 auto', width: 300, background: '#1a1a1a', borderRadius: 44, padding: '12px 10px 18px', boxShadow: '0 24px 48px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                {/* Notch */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <div style={{ width: 72, height: 20, background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2a2a' }} />
                    <div style={{ width: 28, height: 5, borderRadius: 3, background: '#2a2a2a' }} />
                  </div>
                </div>

                {/* Screen */}
                <div style={{ background: '#fff', borderRadius: 30, overflow: 'hidden', height: 560 }}>
                  {/* Status bar */}
                  <div style={{ background: '#f5f5f7', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#333' }}>9:41</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <div style={{ width: 12, height: 7, borderRadius: 2, border: '1.5px solid #555', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '1px', background: '#555', borderRadius: 1, width: '70%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ height: 'calc(100% - 28px)', overflowY: 'auto', padding: '12px 14px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10, lineHeight: 1.3 }}>{picnic.title}</div>
                    {previewHtml && previewHtml !== '<p></p>' ? (
                      <div className="phone-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                      <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', paddingTop: 40 }}>내용 없음</div>
                    )}
                  </div>
                </div>

                {/* Home indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <div style={{ width: 80, height: 4, background: '#444', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 조편성 탭 ─── */}
        {tab === 'groups' && (
          <div style={{ maxWidth: 800 }}>
            {picnic.isAdmin && (
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setGroupName(''); setGroupModal({ mode: 'add' }); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <FiPlus size={14} /> 조 추가
                </button>
              </div>
            )}
            {picnic.groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb', fontSize: 14 }}>
                조가 없습니다.
                {picnic.isAdmin && <><br /><span style={{ color: '#1a73e8', cursor: 'pointer', marginTop: 8, display: 'inline-block' }} onClick={() => { setGroupName(''); setGroupModal({ mode: 'add' }); }}>+ 조 추가하기</span></>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {picnic.groups.map((group, gi) => (
                  <div key={group.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, marginRight: 10, flexShrink: 0 }}>
                        {gi + 1}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#111', flex: 1 }}>{group.name}</span>
                      <span style={{ fontSize: 12, color: '#999', marginRight: 10 }}>{group.members.length}명</span>
                      {picnic.isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setGroupName(group.name); setGroupModal({ mode: 'rename', groupId: group.id }); }}
                            style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', display: 'flex' }}>
                            <FiEdit2 size={12} color="#666" />
                          </button>
                          <button onClick={() => setDelGroup(group)}
                            style={{ padding: '5px 8px', borderRadius: 7, border: 'none', background: '#fff3f3', cursor: 'pointer', display: 'flex' }}>
                            <FiTrash2 size={12} color="#e53e3e" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      {group.members.length === 0 ? (
                        <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>멤버가 없습니다</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {group.members.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px', borderRadius: 20, background: '#f5f5f7', cursor: 'pointer', border: '1px solid #ebebeb' }}
                              onClick={() => setMemberDetail(m)}>
                              {m.photo_url
                                ? <img src={m.photo_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={12} color="#aaa" /></div>
                              }
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>{m.name}</span>
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: TYPE_COLOR[m.type].bg, color: TYPE_COLOR[m.type].text }}>{TYPE_LABEL[m.type]}</span>
                              {picnic.isAdmin && (
                                <button onClick={e => { e.stopPropagation(); removeMember(group.id, m.id); }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', color: '#bbb' }}>
                                  <FiX size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {picnic.isAdmin && (
                        <button onClick={() => openMemberPicker(group)}
                          style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px dashed #c0c0c0', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#888' }}>
                          <FiPlus size={12} /> 멤버 추가
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Group modal ─── */}
      {groupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{groupModal.mode === 'add' ? '조 추가' : '조 이름 변경'}</h2>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGroupSave()}
              placeholder="조 이름 입력" autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setGroupModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleGroupSave} disabled={savingGroup}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {savingGroup ? '저장 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete group ─── */}
      {delGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>"{delGroup.name}" 삭제</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>조원 명단도 모두 제거됩니다.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDelGroup(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleGroupDelete} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Member picker ─── */}
      {pickerGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>멤버 추가</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{pickerGroup.name}에 추가</div>
              </div>
              <button onClick={() => setPickerGroup(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><FiX size={20} color="#555" /></button>
            </div>
            <div style={{ padding: '12px 20px 0' }}>
              <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="이름 검색"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
              {pickerFiltered.length === 0
                ? <div style={{ textAlign: 'center', padding: '30px 0', color: '#ccc', fontSize: 13 }}>멤버가 없습니다</div>
                : pickerFiltered.map(m => {
                    const sel = pickerSelected.has(m.id);
                    return (
                      <div key={m.id} onClick={() => { const s = new Set(pickerSelected); sel ? s.delete(m.id) : s.add(m.id); setPickerSelected(s); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4, background: sel ? '#e8f0fe' : '#fff', border: sel ? '1px solid #1a73e8' : '1px solid #f0f0f0', transition: 'all 0.1s' }}>
                        {m.photo_url
                          ? <img src={m.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={16} color="#aaa" /></div>
                        }
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: TYPE_COLOR[m.type].bg, color: TYPE_COLOR[m.type].text }}>{TYPE_LABEL[m.type]}</span>
                        {sel && <FiCheck size={15} color="#1a73e8" />}
                      </div>
                    );
                  })
              }
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
              <button onClick={() => setPickerGroup(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>취소</button>
              <button onClick={handleAddMembers} disabled={pickerSelected.size === 0 || addingMembers}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: pickerSelected.size === 0 ? '#ccc' : '#1a73e8', color: '#fff', cursor: pickerSelected.size === 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                {addingMembers ? '추가 중...' : `${pickerSelected.size}명 추가`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Member detail ─── */}
      {memberDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => setMemberDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 300, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: '100%', aspectRatio: '4/3', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {memberDetail.photo_url
                ? <img src={memberDetail.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <FiUser size={56} color="#ccc" />
              }
            </div>
            <div style={{ padding: '18px 20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{memberDetail.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: TYPE_COLOR[memberDetail.type].bg, color: TYPE_COLOR[memberDetail.type].text }}>{TYPE_LABEL[memberDetail.type]}</span>
              </div>
              {memberDetail.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, color: '#444' }}>
                  <FiPhone size={14} color="#888" /> {memberDetail.phone}
                </div>
              )}
              {memberDetail.memo && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                  <FiFileText size={14} color="#888" style={{ marginTop: 2 }} /> {memberDetail.memo}
                </div>
              )}
              <button onClick={() => setMemberDetail(null)}
                style={{ marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: '#f5f5f7', cursor: 'pointer', fontSize: 14, color: '#555' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
