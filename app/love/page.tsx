'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface PrayerItem {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface Message {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

const cream     = '#f7f3ed';
const parchment = '#ede7dc';
const gold      = '#b89a5a';
const goldLight = '#d4b87a';
const ink       = '#1e1a14';
const inkMid    = '#4a4236';
const inkSoft   = '#7a7060';

const cardBase: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${parchment}`,
  borderLeft: `3px solid ${gold}`,
  borderRadius: '0 4px 4px 0',
  padding: '18px 20px',
  marginBottom: 10,
};

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{
        width: 24, height: 24, border: `1px solid ${gold}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: gold, fontSize: 13, flexShrink: 0,
      }}>
        {icon}
      </div>
      <h2 style={{
        fontFamily: 'var(--font-noto-serif)', fontSize: 17, fontWeight: 500,
        color: ink, letterSpacing: '0.02em', whiteSpace: 'nowrap',
      }}>
        {title}
      </h2>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${parchment}, transparent)` }} />
    </div>
  );
}

export default function LovePage() {
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(true);


  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadPrayers();
    loadMessages(1);
  }, []);

  const loadPrayers = async () => {
    try {
      const { data } = await supabase
        .from('public_prayer_wall')
        .select('id, title, content, created_at')
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      setPrayers(data || []);
    } finally {
      setPrayerLoading(false);
    }
  };

  const loadMessages = async (p: number) => {
    if (p === 1) setMsgLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/love/messages?page=${p}`);
      const json = await res.json();
      if (p === 1) setMessages(json.data || []);
      else setMessages(prev => [...prev, ...(json.data || [])]);
      setTotal(json.total || 0);
      setPage(p);
    } finally {
      setMsgLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/love/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: authorName, content }),
      });
      if (!res.ok) throw new Error();
      const created: Message = await res.json();
      setMessages(prev => [created, ...prev]);
      setTotal(prev => prev + 1);
      setContent('');
      setFormOpen(false);
      toast.success('응원메세지를 남겼습니다');
    } catch {
      toast.error('잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: cream, minHeight: '100vh', color: ink, fontFamily: 'var(--font-noto-sans)', fontWeight: 300, overflowX: 'hidden', position: 'relative' }}>
      <Toaster position="top-center" />

      {/* 관리자 링크 */}
      <Link href="/love/admin" style={{
        position: 'absolute', top: 14, right: 16, zIndex: 10,
        opacity: 0.25, fontSize: 18, color: inkMid,
        textDecoration: 'none', lineHeight: 1,
        transition: 'opacity 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.25')}
      >⚙</Link>

      {/* 배경 텍스처 */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse at 20% 10%, rgba(184,154,90,0.08) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 90%, rgba(139,74,42,0.06) 0%, transparent 50%)
        `,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── 헤더 ── */}
        <header style={{ textAlign: 'center', padding: '56px 0 40px' }}>

          <p className="anim-fade-up" style={{
            animationDelay: '0.1s',
            fontSize: 11, fontWeight: 500, letterSpacing: '0.22em',
            color: gold, marginBottom: 18,
          }}>
            기도 · PRAYER
          </p>

          <h1 className="anim-fade-up flex justify-center mb-0" style={{
            animationDelay: '0.25s',
            // fontFamily: 'var(--font-noto-serif)',
            fontSize: 'clamp(16px, 6vw, 20px)',
            fontWeight: 400,
            color: ink, lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: 16,
          }}>
            <div className="anim-fade-up mb-0 flex items-center gap-1" style={{ animationDelay: '0s' }}>
            <img
                src="/logo/dk_logo.png" alt="로고"
                style={{ height: 17, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />동광교회 & 사랑부
            </div>
          </h1>

          <p className="anim-fade-up" style={{
            animationDelay: '0.4s',
            fontFamily: 'var(--font-noto-serif)', fontSize: 13, fontWeight: 400,
            color: inkSoft, lineHeight: 1.9,
          }}>
            "이같이 너희 빛이 사람 앞에 비치게 하여 그들로 너희 착한 행실을 보고 하늘에 계신 너희 아버지께 영광을 돌리게 하라"<br/> — 마태복음 5:16
          </p>

          <div className="anim-fade-in" style={{
            animationDelay: '0.55s',
            width: 1, height: 44,
            background: `linear-gradient(to bottom, transparent, ${gold}, transparent)`,
            margin: '24px auto',
            marginBottom: '0'
          }} />
        </header>

        {/* ── 기도제목 섹션 ── */}
        <section className="anim-fade-up" style={{ animationDelay: '0.65s', marginBottom: 52 }}>
          <SectionHeader icon="✦" title="기도제목" />

          {prayerLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: inkSoft, fontSize: 13 }}>불러오는 중…</div>
          ) : prayers.length === 0 ? (
            <div style={{ background: '#fff', border: `1px solid ${parchment}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
              <p style={{ color: inkSoft, fontSize: 13 }}>아직 기도제목이 없어요</p>
            </div>
          ) : (
            prayers.map((prayer, i) => (
              <div key={prayer.id} style={cardBase}>
                {/* <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', color: gold, marginBottom: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </div> */}
                <div
                  className="prose prose-sm max-w-none"
                  style={{ fontSize: 14, lineHeight: 1.85, color: inkMid }}
                  dangerouslySetInnerHTML={{ __html: prayer.content }}
                />
                <div className="text-end" style={{ marginTop: 10, fontSize: 11, color: inkSoft, letterSpacing: '0.04em' }}>
                  {new Date(prayer.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── 응원메세지 섹션 ── */}
        <section className="anim-fade-up" style={{ animationDelay: '0.8s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 24, height: 24, border: `1px solid ${gold}`, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: gold, fontSize: 13, flexShrink: 0,
              }}>✉</div>
              <h2 style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 17, fontWeight: 500, color: ink, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                응원메세지
                {total > 0 && <span style={{ fontSize: 12, color: inkSoft, fontWeight: 400, marginLeft: 8 }}>{total}개</span>}
              </h2>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${parchment}, transparent)` }} />
            </div>
            <button
              onClick={() => setFormOpen(v => !v)}
              style={{
                flexShrink: 0, marginLeft: 16,
                background: formOpen ? parchment : ink,
                color: formOpen ? inkMid : cream,
                border: 'none', cursor: 'pointer',
                padding: '8px 18px', borderRadius: 2,
                fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-noto-sans)',
              }}
            >
              {formOpen ? '닫기' : '메세지 남기기'}
            </button>
          </div>

          {/* 작성 폼 슬라이드 */}
          <div style={{
            display: 'grid',
            gridTemplateRows: formOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.3s ease',
          }}>
            <div style={{ overflow: 'hidden' }}>
              <form onSubmit={handleSubmit} style={{
                background: '#fff', border: `1px solid ${parchment}`,
                borderLeft: `3px solid ${gold}`, borderRadius: '0 4px 4px 0',
                padding: 20, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16,
              }}>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="이름 (선택, 기본: DK)"
                  style={{
                    background: parchment, border: 'none',
                    borderRadius: 2, padding: '9px 12px',
                    fontSize: 13, color: inkMid, outline: 'none',
                    fontFamily: 'var(--font-noto-sans)',
                  }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); }
                    }}
                    placeholder="응원의 말씀이나 기도를 남겨주세요 (Enter 전송)"
                    rows={3}
                    autoFocus={formOpen}
                    style={{
                      flex: 1, background: parchment, border: 'none',
                      borderRadius: 2, padding: '9px 12px',
                      fontSize: 13, color: inkMid, outline: 'none',
                      resize: 'none', fontFamily: 'var(--font-noto-sans)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !content.trim()}
                    style={{
                      background: gold, color: '#fff', border: 'none',
                      borderRadius: 2, padding: '0 16px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: (!content.trim() || submitting) ? 0.4 : 1,
                      transition: 'opacity 0.2s', flexShrink: 0,
                      fontFamily: 'var(--font-noto-sans)',
                    }}
                  >
                    {submitting ? '…' : '전송'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 메세지 목록 */}
          {msgLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: inkSoft, fontSize: 13 }}>불러오는 중…</div>
          ) : messages.length === 0 ? (
            <div style={{ background: '#fff', border: `1px solid ${parchment}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
              <p style={{ color: inkSoft, fontSize: 13 }}>첫 응원메세지를 남겨보세요</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} style={{ ...cardBase, borderLeftColor: goldLight }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: inkMid }}>{msg.author_name}</span>
                    <span style={{ fontSize: 11, color: inkSoft, letterSpacing: '0.04em' }}>
                      {new Date(msg.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: inkMid, whiteSpace: 'pre-wrap', margin: 0, fontWeight: 300 }}>
                    {msg.content}
                  </p>
                </div>
              ))}

              {messages.length < total && (
                <button
                  onClick={() => loadMessages(page + 1)}
                  disabled={loadingMore}
                  style={{
                    width: '100%', marginTop: 4, padding: '12px 0',
                    background: parchment, border: `1px solid ${parchment}`,
                    borderRadius: 2, fontSize: 12, fontWeight: 500,
                    color: gold, cursor: 'pointer', letterSpacing: '0.06em',
                    opacity: loadingMore ? 0.5 : 1,
                    fontFamily: 'var(--font-noto-sans)',
                  }}
                >
                  {loadingMore ? '불러오는 중…' : `더 보기 (${total - messages.length}개)`} 
                </button>
              )}
            </>
          )}
        </section>

        {/* 푸터 */}
        <footer className="anim-fade-in" style={{ animationDelay: '1.2s', textAlign: 'center', paddingTop: 56, paddingBottom: 16 }}>
          <div style={{ color: gold, fontSize: 18, marginBottom: 12 }}>✞</div>
          <div style={{
            display: 'inline-block', textAlign: 'left',
            borderTop: `1px solid ${parchment}`, paddingTop: 20,
            fontSize: 11, color: inkSoft, lineHeight: 2.2, letterSpacing: '0.04em',
          }}>
            <div><span style={{ color: inkMid, fontWeight: 500 }}>주소</span>&nbsp;&nbsp;(06959) 서울특별시 동작구 성대로1길 26 제2교육관 갈리리홀</div>
            <div style={{ fontSize: 10, color: inkSoft, marginTop: -4, marginBottom: 2 }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(상도동, 동광교회)</div>
            <div><span style={{ color: inkMid, fontWeight: 500 }}>예배시간</span>&nbsp;&nbsp;주일 오후 12시</div>
            <div><span style={{ color: inkMid, fontWeight: 500 }}>특별한날</span>&nbsp;&nbsp;매달 4번째 주는 열린예배로 드려집니다♥</div>
          </div>
        </footer>

      </div>
    </div>
  );
}
