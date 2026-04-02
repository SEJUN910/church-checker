'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiEdit2, FiUser, FiPhone, FiFileText } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

type MemberType = 'student' | 'parent' | 'teacher' | 'other';
const TYPE_LABEL: Record<MemberType, string> = { student: '학생', parent: '학부모', teacher: '선생님', other: '기타' };
const TYPE_COLOR: Record<MemberType, { bg: string; text: string }> = {
  student: { bg: '#e8f0fe', text: '#1a73e8' },
  parent:  { bg: '#fef3e2', text: '#e37400' },
  teacher: { bg: '#e6f4ea', text: '#188038' },
  other:   { bg: '#f3f3f3', text: '#777777' },
};

interface Member { id: string; name: string; photo_url: string | null; phone: string | null; memo: string | null; type: MemberType; }
interface Group  { id: string; name: string; members: Member[]; }
interface Picnic { id: string; title: string; description: string | null; church_id: string; images: unknown[]; groups: Group[]; isAdmin: boolean; }

export default function PicnicPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [loading, setLoading]           = useState(true);
  const [picnic, setPicnic]             = useState<Picnic | null>(null);
  const [memberDetail, setMemberDetail] = useState<Member | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const res = await fetch(`/api/picnic/${id}`);
    if (!res.ok) { toast.error('불러오기 실패'); return; }
    const { picnic: data } = await res.json() as { picnic: Picnic };
    setPicnic(data);
    setLoading(false);
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#aaa' }}>
      로딩 중...
    </div>
  );
  if (!picnic) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#aaa', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div>피크닉 정보를 찾을 수 없습니다.</div>
    </div>
  );

  const hasContent = picnic.description && picnic.description !== '<p></p>';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', paddingBottom: 60 }}>
      <Toaster />
      <style>{`
        .preview-body p  { margin: 0 0 10px; font-size: 15px; line-height: 1.75; color: #222; }
        .preview-body p[style*="text-align: center"] { text-align: center; }
        .preview-body p[style*="text-align: right"]  { text-align: right; }
        .preview-body ul, .preview-body ol { padding-left: 22px; margin: 6px 0 12px; font-size: 15px; line-height: 1.75; }
        .preview-body img { max-width: 100%; border-radius: 10px; margin: 6px 0; }
        .preview-body strong { font-weight: 700; }
        .preview-body em { font-style: italic; }
        .preview-body u  { text-decoration: underline; }
        .preview-body::after { content: ''; display: table; clear: both; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/picnic')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <FiArrowLeft size={18} color="#555" />
          </button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111', flex: 1 }}>{picnic.title}</h1>
          {picnic.isAdmin && (
            <button onClick={() => router.push(`/picnic/${id}/edit`)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555', fontWeight: 500 }}>
              <FiEdit2 size={13} /> 편집
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ─── 안내 ─── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 10, letterSpacing: '0.04em' }}>📋 안내</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 26px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            {hasContent ? (
              <div className="preview-body" dangerouslySetInnerHTML={{ __html: picnic.description! }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#ccc', fontSize: 14 }}>
                안내 내용이 없습니다.
                {picnic.isAdmin && (
                  <><br />
                  <span style={{ color: '#1a73e8', cursor: 'pointer', marginTop: 8, display: 'inline-block' }}
                    onClick={() => router.push(`/picnic/${id}/edit`)}>
                    + 편집하러 가기
                  </span></>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── 조편성 ─── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 10, letterSpacing: '0.04em' }}>👥 조편성</div>
          {picnic.groups.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 0', textAlign: 'center', color: '#bbb', fontSize: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              조편성이 없습니다.
              {picnic.isAdmin && (
                <><br />
                <span style={{ color: '#1a73e8', cursor: 'pointer', marginTop: 8, display: 'inline-block' }}
                  onClick={() => router.push(`/picnic/${id}/edit`)}>
                  + 편집하러 가기
                </span></>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {picnic.groups.map((group, gi) => (
                <div key={group.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>
                      {gi + 1}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111', flex: 1 }}>{group.name}</span>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{group.members.length}명</span>
                  </div>

                  {/* Members */}
                  <div style={{ padding: '14px 18px' }}>
                    {group.members.length === 0 ? (
                      <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>멤버가 없습니다</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {group.members.map(m => (
                          <div key={m.id}
                            onClick={() => setMemberDetail(m)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px 7px 7px', borderRadius: 24, background: '#f5f5f7', cursor: 'pointer', border: '1px solid #ebebeb' }}>
                            {m.photo_url
                              ? <img src={m.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                              : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={13} color="#aaa" /></div>
                            }
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{m.name}</span>
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 7, background: TYPE_COLOR[m.type].bg, color: TYPE_COLOR[m.type].text }}>{TYPE_LABEL[m.type]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Member detail popup */}
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
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: TYPE_COLOR[memberDetail.type].bg, color: TYPE_COLOR[memberDetail.type].text }}>
                  {TYPE_LABEL[memberDetail.type]}
                </span>
              </div>
              {memberDetail.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, color: '#444' }}>
                  <FiPhone size={14} color="#888" /> {memberDetail.phone}
                </div>
              )}
              {memberDetail.memo && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                  <FiFileText size={14} color="#888" style={{ marginTop: 2, flexShrink: 0 }} /> {memberDetail.memo}
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
