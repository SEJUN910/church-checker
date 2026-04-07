'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { PiHandsPrayingFill } from 'react-icons/pi';

interface Message {
  id: string;
  author_name: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
}

const POLL_MS       = 10_000;
const MAX_FEED      = 40;
const MAX_NEW_PANEL = 4;

// 스테퍼
const INIT_SLOTS = 12; // 초기 로드 슬롯 수 (가변 높이라 화면을 넘치게 넉넉히)
const STEP_MS = 3400;  // 한 칸 대기(ms)
const ANIM_MS = 700;   // 이동 애니메이션(ms)

const CONFETTI_COLORS = ['#ff4d6d','#ff9a3c','#ffd60a','#4ade80','#60a5fa','#a78bfa','#f472b6','#34d399','#fb923c','#38bdf8'];
const CONFETTI_ANIMS  = ['confettiPopA','confettiPopB','confettiPopC','confettiPopD','confettiPopE','confettiPopF','confettiPopG','confettiPopH'];
const FLOAT_ANIMS     = ['floatA','floatB','floatC'];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const accent  = '#c9a84c';
const accentD = '#7a5a10';
const ink     = '#1a1a1a';
const inkMid  = '#444444';
const inkSoft = '#888888';

interface Particle { id: number; color: string; shape: number; anim: string; dur: number; delay: number; w: number; h: number; }
interface HeartParticle { id: number; x: number; dur: number; delay: number; size: number; }
interface SlotItem  { msg: Message; uid: string; }

/* ── 말풍선 ── */
function ChatBubble({ msg, isNew }: { msg: Message; isNew: boolean }) {
  const h      = hashId(msg.id);
  const isLeft = h % 2 === 0;
  const hasImage = !!msg.image_url;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isLeft ? 'flex-start' : 'flex-end',
      padding: '10px 28px',
      gap: 4,
      animationName: isNew ? FLOAT_ANIMS[h % FLOAT_ANIMS.length] : undefined,
      animationDuration: isNew ? `${2.8 + (h % 5) * 0.4}s` : undefined,
      animationTimingFunction: isNew ? 'ease-in-out' : undefined,
      animationIterationCount: isNew ? 'infinite' : undefined,
    }}>
      {/* 버블 */}
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '72%' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: isLeft ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
          padding: hasImage ? '8px' : '10px 16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {hasImage && (
            <img
              src={msg.image_url!}
              alt=""
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 180,
                minHeight: 80,
                objectFit: 'contain',
                borderRadius: 10,
                marginBottom: msg.content ? 6 : 0,
              }}
            />
          )}
          {msg.content && (
            <p style={{
              fontSize: 15, lineHeight: 1.5, color: ink,
              margin: 0, fontWeight: 500,
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </p>
          )}
        </div>
        {/* 꼬리 */}
        <div style={{
          position: 'absolute', bottom: -10,
          ...(isLeft ? { left: 16 } : { right: 16 }),
          width: 0, height: 0,
          borderLeft:  isLeft ? '0 solid transparent'   : '14px solid transparent',
          borderRight: isLeft ? '14px solid transparent' : '0 solid transparent',
          borderTop: '12px solid #ffffff',
          filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.07))',
        }} />
      </div>

      {/* 이름 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
        flexDirection: isLeft ? 'row' : 'row-reverse',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#2a2a2a' }}>{msg.author_name}</span>
        {isNew && (
          <span style={{ background: '#e94545', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 10 }}>NEW</span>
        )}
        {msg.likes_count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: accentD }}>
            <PiHandsPrayingFill size={10} color={accent} /> {msg.likes_count}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CheerPage() {
  const [latest, setLatest]             = useState<Message[]>([]);
  const [best, setBest]                 = useState<Message[]>([]);
  const [newPanelMsgs, setNewPanelMsgs] = useState<Message[]>([]);
  const [newIds, setNewIds]             = useState<Set<string>>(new Set());
  const [total, setTotal]               = useState(0);
  const [displayTotal, setDisplayTotal] = useState(0);
  const prevTotal                       = useRef(0);
  const [now, setNow]                   = useState<Date>(() => new Date());
  const [particles, setParticles]       = useState<Particle[]>([]);
  const [hearts, setHearts]             = useState<HeartParticle[]>([]);
  const heartPid                        = useRef(0);
  const heartAsideRef                   = useRef<HTMLDivElement>(null);
  const [burstMsg, setBurstMsg]         = useState<Message | null>(null);
  const [burstLeave, setBurstLeave]     = useState(false);
  const burstQueue                      = useRef<Message[]>([]);
  const burstBusy                       = useRef(false);

  /* ── 카운트업 애니메이션 ── */
  useEffect(() => {
    const from = prevTotal.current;
    const to   = total;
    if (from === to) return;
    prevTotal.current = to;
    const diff     = to - from;
    const duration = Math.min(900, diff * 60);
    const start    = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayTotal(Math.round(from + diff * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [total]);

  const showNextBurst = useCallback(() => {
    if (burstQueue.current.length === 0) { burstBusy.current = false; return; }
    burstBusy.current = true;
    const next = burstQueue.current.shift()!;
    setBurstLeave(false);
    setBurstMsg(next);
    setTimeout(() => setBurstLeave(true), 4500);
    setTimeout(() => { setBurstMsg(null); showNextBurst(); }, 5200);
  }, []);

  // 스테퍼
  const [slots, setSlots]       = useState<SlotItem[]>([]);
  const [offset, setOffset]     = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const allMsgsRef  = useRef<Message[]>([]);
  const slotListRef = useRef<HTMLDivElement>(null);
  const headRef     = useRef(0);
  const uidRef      = useRef(0);
  const initialized = useRef(false);
  const stepReady   = useRef(false); // 초기화 완료 후에만 스텝 허용

  const prevIds = useRef<Set<string>>(new Set());
  const pid     = useRef(0);

  /* ── 스테퍼 초기화 ── */
  useEffect(() => {
    allMsgsRef.current = [...latest];
    if (!initialized.current && latest.length > 0) {
      initialized.current = true;
      const count = INIT_SLOTS;
      setSlots(Array.from({ length: count }, (_, i) => ({
        msg: latest[i % latest.length],
        uid: String(uidRef.current++),
      })));
      headRef.current = count;
      setTimeout(() => { stepReady.current = true; }, STEP_MS);
    }
  }, [latest]);

  /* ── 한 칸씩 올라가는 스텝 — 첫 슬롯의 실제 DOM 높이만큼 이동 ── */
  const doStep = useCallback(() => {
    if (!stepReady.current || allMsgsRef.current.length === 0) return;
    const firstChild = slotListRef.current?.children[0] as HTMLElement | undefined;
    const moveH = firstChild ? firstChild.offsetHeight : 100;

    setIsMoving(true);
    setOffset(-moveH);

    setTimeout(() => {
      const nextMsg = allMsgsRef.current[headRef.current % allMsgsRef.current.length];
      headRef.current++;
      flushSync(() => {
        setIsMoving(false);
        setOffset(0);
        setSlots(prev => [...prev.slice(1), { msg: nextMsg, uid: String(uidRef.current++) }]);
      });
    }, ANIM_MS);
  }, []);

  useEffect(() => {
    const iv = setInterval(doStep, STEP_MS);
    return () => clearInterval(iv);
  }, [doStep]);

  /* ── 폴링 ── */
  const fetchData = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/love/messages?page=1&sort=latest'),
      fetch('/api/love/messages?page=1&sort=likes'),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    const msgs: Message[]    = j1.data || [];
    const topMsgs: Message[] = (j2.data || []).slice(0, 3);

    const curIds = new Set(msgs.map((m: Message) => m.id));
    const added  = [...curIds].filter(id => prevIds.current.size > 0 && !prevIds.current.has(id));

    if (added.length > 0) {
      setNewIds(prev => new Set([...prev, ...added]));
      const newP: Particle[] = Array.from({ length: 80 }, () => {
        const shape = Math.floor(Math.random() * 3);
        const w = shape === 2 ? 10 : (8 + Math.floor(Math.random() * 8));
        const h = shape === 1 ? (18 + Math.floor(Math.random() * 12)) : w;
        return {
          id: pid.current++,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          shape, w, h,
          anim: CONFETTI_ANIMS[Math.floor(Math.random() * CONFETTI_ANIMS.length)],
          dur: 2.8 + Math.random() * 2.0,
          delay: Math.random() * 0.6,
        };
      });
      setParticles(p => [...p, ...newP]);
      setTimeout(() => setParticles(p => p.filter(pp => !newP.find(np => np.id === pp.id))), 6000);

      const newMsgs = msgs
        .filter((m: Message) => added.includes(m.id))
        .sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (newMsgs.length > 0) {
        setNewPanelMsgs(prev => [...newMsgs, ...prev].slice(0, MAX_NEW_PANEL));
        burstQueue.current.push(...newMsgs);
        if (!burstBusy.current) showNextBurst();
        fireHearts();
      }
      setTimeout(() => setNewIds(prev => {
        const next = new Set(prev);
        added.forEach(id => next.delete(id));
        return next;
      }), 3 * 60 * 1000);
    }

    prevIds.current = curIds;
    setLatest(msgs.slice(0, MAX_FEED));
    setBest(topMsgs);
    setTotal(j1.total || 0);
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // 하트 발사 함수 (외부에서도 호출 가능하도록)
  const fireHearts = useCallback(() => {
    const newH: HeartParticle[] = Array.from({ length: 12 }, () => ({
      id: heartPid.current++,
      x: 10 + Math.random() * 80,
      dur: 2.2 + Math.random() * 1.4,
      delay: Math.random() * 0.8,
      size: 14 + Math.floor(Math.random() * 16),
    }));
    setHearts(h => [...h, ...newH]);
    setTimeout(() => setHearts(h => h.filter(hp => !newH.find(np => np.id === hp.id))), 5000);
  }, []);

  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: '#f5f3f0',
      color: ink, fontFamily: 'var(--font-noto-sans)', fontWeight: 400,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>

      {/* ── 하트 파티클 (우측 1/3 영역) ── */}
      {hearts.map(hp => (
        <div key={hp.id} style={{
          position: 'fixed',
          top: 'calc(100vh - 80px)',
          left: `calc(66.6% + ${hp.x * 0.333}%)`,
          fontSize: hp.size, lineHeight: 1,
          animationName: 'heartRise',
          animationDuration: `${hp.dur}s`,
          animationDelay: `${hp.delay}s`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'both',
          animationPlayState: 'running',
          willChange: 'transform, opacity',
          pointerEvents: 'none', zIndex: 550,
        }}>❤️</div>
      ))}

      {/* ── 콘페티 ── */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'fixed',
          left: `calc(50% - ${Math.round(p.w / 2)}px)`,
          top:  `calc(50% - ${Math.round(p.h / 2)}px)`,
          width: p.w, height: p.h,
          borderRadius: p.shape === 2 ? '50%' : 2,
          background: p.color, zIndex: 600, pointerEvents: 'none',
          animationName: p.anim, animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`, animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
        }} />
      ))}

      {/* ── 편지 오버레이 ── */}
      {burstMsg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,8,30,0.5)',
          animationName: burstLeave ? 'overlayOut' : 'overlayIn',
          animationDuration: burstLeave ? '0.7s' : '0.3s', animationFillMode: 'forwards',
        }}>
          <div style={{
            animationName: burstLeave ? 'burstOut' : 'burstIn',
            animationDuration: '0.7s',
            animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)', animationFillMode: 'forwards',
          }}>
            <div style={{
              width: 400, position: 'relative',
              background: '#fffdf0', borderRadius: 22,
              boxShadow: '0 32px 80px rgba(0,0,0,0.38)',
              border: '2px solid #e8dcc8',
            }}>
              <div style={{
                position: 'absolute', top: -12, right: -10, zIndex: 10,
                background: '#e94545', color: '#fff',
                fontSize: 12, fontWeight: 800, letterSpacing: '0.15em',
                padding: '5px 14px', borderRadius: 20,
                boxShadow: '0 4px 12px rgba(233,69,69,0.5)',
              }}>NEW</div>
              <div style={{
                height: 120, position: 'relative',
                background: 'linear-gradient(180deg,#fff8e8 0%,#fef0d8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', borderRadius: '20px 20px 0 0',
              }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                    <line x1="0" y1="0" x2="200" y2="120" stroke="rgba(200,175,130,0.25)" strokeWidth="1" />
                    <line x1="400" y1="0" x2="200" y2="120" stroke="rgba(200,175,130,0.25)" strokeWidth="1" />
                  </svg>
                </div>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
                  background: 'linear-gradient(160deg,#fde8a0,#fdd060)',
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  transformOrigin: '50% 0%',
                  animationName: 'envelopeFlapOpen', animationDuration: '0.55s',
                  animationDelay: '0.5s', animationTimingFunction: 'ease-in',
                  animationFillMode: 'forwards', zIndex: 3,
                }} />
                <div style={{
                  fontSize: 42, zIndex: 2, position: 'relative',
                  animationName: 'fadeIn', animationDuration: '0.4s',
                  animationDelay: '0.9s', animationFillMode: 'both', opacity: 0,
                }}>💌</div>
              </div>
              <div style={{
                background: '#ffffff', padding: '24px 30px 28px',
                borderRadius: '0 0 20px 20px',
                animationName: 'fadeIn', animationDuration: '0.5s',
                animationDelay: '0.85s', animationFillMode: 'both', opacity: 0,
              }}>
                {burstMsg.image_url && (
                  <img src={burstMsg.image_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
                )}
                {burstMsg.content && (
                  <p style={{ fontSize: 19, lineHeight: 1.9, color: ink, margin: '0 0 16px', textAlign: 'center', fontWeight: 500 }}>
                    {burstMsg.content}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid rgba(201,168,76,0.2)' }}>
                  <span style={{ fontSize: 13, color: inkSoft, fontWeight: 600 }}>— {burstMsg.author_name}</span>
                  {burstMsg.likes_count > 0 && <span style={{ fontSize: 13, color: accentD, fontWeight: 600 }}>🙏 {burstMsg.likes_count}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 본문 ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ══ 좌측: 베스트 ══ */}
        <aside style={{
          flex: 1, minWidth: 0,
          borderRight: `1px solid rgba(0,0,0,0.08)`,
          padding: 'clamp(14px,1.4vh,24px) clamp(14px,1.2vw,28px)',
          display: 'flex', flexDirection: 'column', gap: 'clamp(8px,0.8vh,16px)',
          background: '#ffffff', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 'clamp(8px,0.8vh,14px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <img src="/logo/dk_logo.png" alt="" style={{ height: 'clamp(16px,1.8vh,28px)', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <div style={{ fontSize: 'clamp(13px,1.1vw,22px)', fontWeight: 700, color: accentD, letterSpacing: '0.1em' }}>동광교회</div>
            </div>  
            <div style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, marginTop: 1 }}>
              농인부 & 사랑부
            </div>
          </div>

          <div style={{ alignSelf: 'flex-start', fontSize: 'clamp(10px,0.75vw,15px)', letterSpacing: '0.3em', fontWeight: 700, color: accent, background: 'rgba(201,168,76,0.1)', padding: '4px 12px', borderRadius: 20 }}>
            ✦ 인기 응원
          </div>

          {best[0] ? (
            <div style={{
              background: 'linear-gradient(135deg,#fffbe6 0%,#fde88a 60%,#f8d44c 100%)',
              border: `2px solid rgba(201,168,76,0.6)`,
              borderRadius: 18, padding: 'clamp(12px,1.2vh,20px) clamp(14px,1.2vw,22px)', flexShrink: 0,
              boxShadow: '0 12px 40px rgba(201,168,76,0.35), 0 4px 12px rgba(201,168,76,0.18)',
              animationName: 'glowPulse', animationDuration: '2.8s',
              animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* 광채 shimmer */}
              <div style={{
                position: 'absolute', top: 0, left: '-60%', width: '40%', height: '100%',
                background: 'linear-gradient(105deg,transparent,rgba(255,255,255,0.45),transparent)',
                animationName: 'shimmerSlide', animationDuration: '3s',
                animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{
                  fontSize: 'clamp(22px,2.2vw,38px)',
                  animationName: 'crownWiggle', animationDuration: '2.0s',
                  animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
                  display: 'inline-block',
                }}>🙏</span>
                <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', fontWeight: 800, color: accentD, letterSpacing: '0.2em' }}>1위</span>
              </div>
              {best[0].image_url && (
                <img src={best[0].image_url} alt="" style={{ width: '100%', maxHeight: 'clamp(80px,8vh,140px)', objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
              )}
              {best[0].content && <p style={{ fontSize: 'clamp(14px,1.1vw,22px)', lineHeight: 1.8, color: ink, margin: '0 0 10px', fontWeight: 500 }}>{best[0].content}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid rgba(201,168,76,0.18)` }}>
                <span style={{ fontSize: 'clamp(12px,0.9vw,18px)', color: inkSoft, fontWeight: 600 }}>— {best[0].author_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(201,168,76,0.1)', padding: '3px 10px', borderRadius: 20 }}>
                  <PiHandsPrayingFill size={14} color={accent} />
                  <span style={{ fontSize: 'clamp(14px,1.1vw,22px)', fontWeight: 700, color: accentD }}>{best[0].likes_count}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: inkSoft, fontSize: 'clamp(13px,1vw,20px)', textAlign: 'center', padding: '30px 0' }}>불러오는 중…</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px,0.7vh,12px)', flex: 1, overflow: 'hidden' }}>
            {best.slice(1).map((msg, i) => (
              <div key={msg.id} style={{ background: '#fafafa', border: `1px solid rgba(0,0,0,0.07)`, borderRadius: 12, padding: 'clamp(8px,0.9vh,16px) clamp(10px,1vw,18px)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', fontWeight: 700, color: accentD, letterSpacing: '0.15em' }}>{i === 0 ? '🥈 2위' : '🥉 3위'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 'clamp(11px,0.85vw,17px)', color: accentD, fontWeight: 600 }}>
                    <PiHandsPrayingFill size={13} color={accent} /><span>{msg.likes_count}</span>
                  </div>
                </div>
                {msg.image_url && (
                  <img src={msg.image_url} alt="" style={{ width: '100%', maxHeight: 'clamp(60px,6vh,100px)', objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />
                )}
                {msg.content && <p style={{ fontSize: 'clamp(12px,0.95vw,19px)', lineHeight: 1.6, color: inkMid, margin: '0 0 4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{msg.content}</p>}
                <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft }}>— {msg.author_name}</span>
              </div>
            ))}
          </div>

          {/* QR 코드 */}
          <div style={{
            paddingTop: 10, borderTop: `1px solid rgba(0,0,0,0.06)`,
            display: 'flex', alignItems: 'center', gap: 'clamp(10px,1vw,18px)',
          }}>
            <img
              src="/logo/dk-qr.png"
              alt="QR"
              style={{
                width: 'clamp(56px,6vw,100px)', height: 'clamp(56px,6vw,100px)',
                objectFit: 'contain', flexShrink: 0
              }}
            />
            <div>
              <div style={{ fontSize: 'clamp(11px,0.85vw,16px)', fontWeight: 700, color: ink, marginBottom: 3 }}>
                응원 메세지 남기기
              </div>
              <div style={{ fontSize: 'clamp(10px,0.75vw,14px)', color: inkSoft, lineHeight: 1.7 }}>
                QR을 스캔해주세요!
              </div>
            </div>
          </div>
          {/* <div style={{ fontSize: 'clamp(10px,0.75vw,14px)', color: inkSoft, opacity: 0.6, lineHeight: 1.7, paddingTop: 6 }}>
            농인부 & 사랑부를 위해 기도해주세요.
          </div> */}

          {/* <div style={{ fontSize: 'clamp(10px,0.75vw,15px)', color: inkSoft, lineHeight: 1.9, textAlign: 'center', opacity: 0.7 }}>
            "이같이 너희 빛이 사람 앞에 비치게 하여 그들로 너희 착한 행실을 보고
            하늘에 계신 너희 아버지께 영광을 돌리게 하라" — 마태복음 5:16
          </div> */}
        </aside>

        {/* ══ 가운데: 스테퍼 피드 ══ */}
        <main style={{ flex: 2, position: 'relative', overflow: 'hidden' }}>

          {/* 상단 페이드 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom,#f5f3f0,transparent)', pointerEvents: 'none', zIndex: 10 }} />

          {/* 슬롯 컨테이너 */}
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <div ref={slotListRef} style={{
              transform: `translateY(${offset}px)`,
              transition: isMoving
                ? `transform ${ANIM_MS}ms cubic-bezier(0.4,0,0.2,1)`
                : 'none',
              willChange: 'transform',
            }}>
              {slots.map(item => (
                <ChatBubble key={item.uid} msg={item.msg} isNew={newIds.has(item.msg.id)} />
              ))}
            </div>
          </div>

          {/* 하단 페이드 */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to top,#f5f3f0,transparent)', pointerEvents: 'none', zIndex: 10 }} />

          {slots.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkSoft, fontSize: 15 }}>
              응원메세지를 기다리고 있어요 🙏
            </div>
          )}
        </main>

        {/* ══ 우측: 시계 + NEW 패널 ══ */}
        <aside ref={heartAsideRef} style={{
          flex: 1, minWidth: 0,
          borderLeft: `1px solid rgba(0,0,0,0.08)`,
          padding: 'clamp(14px,1.4vh,24px) clamp(12px,1vw,24px)',
          display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1vh,18px)',
          position: 'relative',
          background: '#ffffff', overflow: 'hidden',
        }}>

          {/* 시계 */}
          {(() => {
            const h24 = now.getHours();
            const isPM = h24 >= 12;
            const h12 = h24 % 12 || 12;
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const hh = String(h12).padStart(2, '0');
            const DAYS = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
            const dayStr = DAYS[now.getDay()];
            const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일`;
            return (
              <div style={{
                background: 'linear-gradient(145deg, #2c1e10 0%, #3d2a14 100%)',
                borderRadius: 18,
                padding: 'clamp(14px,1.4vh,24px) clamp(16px,1.4vw,26px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                flexShrink: 0,
                position: 'relative', overflow: 'hidden',
              }}>
                {/* 배경 글로우 */}
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 100, height: 100,
                  borderRadius: '50%', background: 'rgba(201,168,76,0.18)', filter: 'blur(30px)',
                  pointerEvents: 'none',
                }} />
                {/* 날짜 + 요일 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(8px,1vh,16px)', paddingBottom: 'clamp(6px,0.7vh,10px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 'clamp(10px,0.75vw,14px)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', fontWeight: 600 }}>
                    {dateStr}
                  </span>
                  <span style={{ fontSize: 'clamp(10px,0.75vw,14px)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
                    {dayStr}
                  </span>
                </div>
                {/* 시간 */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(2px,0.3vw,6px)' }}>
                  <span style={{
                    fontSize: 'clamp(28px,2.8vw,56px)', fontFamily: "'Courier New',monospace",
                    fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  }}>{hh}</span>
                  <span style={{ fontSize: 'clamp(22px,2.2vw,44px)', fontWeight: 800, color: 'rgba(255,255,255,0.4)', lineHeight: 1.05, alignSelf: 'center' }}>:</span>
                  <span style={{
                    fontSize: 'clamp(28px,2.8vw,56px)', fontFamily: "'Courier New',monospace",
                    fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  }}>{mm}</span>
                  <span style={{ fontSize: 'clamp(22px,2.2vw,44px)', fontWeight: 800, color: 'rgba(255,255,255,0.25)', lineHeight: 1.05, alignSelf: 'center' }}>:</span>
                  <span style={{
                    fontSize: 'clamp(18px,1.6vw,34px)', fontFamily: "'Courier New',monospace",
                    fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1, alignSelf: 'flex-end', paddingBottom: 2,
                  }}>{ss}</span>
                  <span style={{
                    fontSize: 'clamp(9px,0.65vw,13px)', fontWeight: 700,
                    color: isPM ? '#7ecfff' : '#ffd580',
                    background: isPM ? 'rgba(126,207,255,0.15)' : 'rgba(255,213,128,0.15)',
                    padding: '2px 5px', borderRadius: 5,
                    alignSelf: 'flex-end', paddingBottom: 3, letterSpacing: '0.05em',
                  }}>{isPM ? 'PM' : 'AM'}</span>
                </div>
                {/* LIVE 도트 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', marginTop: 'clamp(8px,0.8vh,14px)' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: '#e94545',
                    animationName: 'livePulse', animationDuration: '1.6s',
                    animationTimingFunction: 'ease', animationIterationCount: 'infinite',
                    boxShadow: '0 0 0 0 rgba(233,69,69,0.7)',
                  }} />
                  <span style={{ fontSize: 'clamp(9px,0.65vw,13px)', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.3em', fontWeight: 700 }}>LIVE</span>
                </div>
                {/* 응원 카운터 강조 블록 */}
                {total > 0 && (
                  <div style={{
                    marginTop: 'clamp(8px,0.8vh,12px)',
                    background: 'rgba(255,213,128,0.07)',
                    borderRadius: 12, padding: 'clamp(8px,0.9vh,14px) 0',
                    textAlign: 'center',
                    border: '1px solid rgba(255,213,128,0.25)',
                  }}>
                    <div style={{ fontSize: 'clamp(7px,0.5vw,10px)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.25em', marginBottom: 3 }}>응원메세지</div>
                    <div style={{
                      fontSize: 'clamp(40px,3.8vw,72px)', fontWeight: 900,
                      color: '#ffd580', lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      textShadow: '0 0 24px rgba(255,213,128,0.8), 0 0 48px rgba(255,213,128,0.4)',
                    }}>{displayTotal}</div>
                    {/* <div style={{ fontSize: 'clamp(9px,0.65vw,12px)', color: 'rgba(255,213,128,0.55)', marginTop: 3, fontWeight: 700, letterSpacing: '0.1em' }}>개</div> */}
                  </div>
                )}
              </div>
            );
          })()}

          {/* NEW 응원 섹션 */}
          <div style={{
            alignSelf: 'flex-start', fontSize: 'clamp(10px,0.75vw,15px)', letterSpacing: '0.3em', fontWeight: 700, color: '#e94545',
            background: 'rgba(233,69,69,0.08)', padding: '5px 13px', borderRadius: 20,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e94545', animationName: 'livePulse', animationDuration: '1.5s', animationTimingFunction: 'ease', animationIterationCount: 'infinite' }} />
            NEW 응원
          </div>

          {newPanelMsgs.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: inkSoft, textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(32px,3vw,56px)',
                animationName: 'highlightShine', animationDuration: '2.5s',
                animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
              }}>💌</div>
              <div style={{ fontSize: 'clamp(12px,0.95vw,19px)', color: inkSoft, opacity: 0.7, lineHeight: 1.8 }}>
                새 응원메세지가<br />도착하면 여기에<br />표시됩니다
              </div>
              {total > 0 && (
                <div style={{
                  marginTop: 8, padding: 'clamp(8px,1vh,16px) clamp(14px,1.2vw,22px)', borderRadius: 12,
                  background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                }}>
                  <div style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, marginBottom: 4 }}>응원메세지</div>
                  <div style={{ fontSize: 'clamp(26px,2.5vw,48px)', fontWeight: 800, color: accentD }}>{total}</div>
                  <div style={{ fontSize: 'clamp(10px,0.75vw,15px)', color: inkSoft }}>개</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px,0.7vh,12px)', overflow: 'hidden' }}>
              {newPanelMsgs.map((msg, i) => (
                <div key={`${msg.id}-panel-${i}`} style={{
                  padding: 'clamp(10px,1vh,18px) clamp(12px,1vw,20px)', borderRadius: 14,
                  background: i === 0 ? '#fff' : '#fafafa',
                  border: `1.5px solid ${i === 0 ? 'rgba(233,69,69,0.22)' : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: i === 0 ? '0 4px 16px rgba(0,0,0,0.07)' : 'none',
                  opacity: i === 0 ? 1 : i === 1 ? 0.82 : 0.6,
                  animationName: i === 0 ? 'newPanelSlideIn' : 'none',
                  animationDuration: '0.42s',
                  animationTimingFunction: 'cubic-bezier(0.34,1.15,0.64,1)',
                  animationFillMode: 'both',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    {i === 0 && <span style={{
                      background: '#e94545', color: '#fff',
                      fontSize: 'clamp(9px,0.7vw,13px)', fontWeight: 800, letterSpacing: '0.1em',
                      padding: '2px 6px', borderRadius: 8,
                      display: 'inline-block',
                      animationName: 'badgeShake', animationDuration: '0.55s',
                      animationDelay: '0.3s', animationTimingFunction: 'ease-in-out',
                      animationFillMode: 'both',
                    }}>NEW</span>}
                    <span style={{ fontSize: 'clamp(12px,1vw,20px)', fontWeight: 700, color: '#1a1a1a' }}>{msg.author_name}</span>
                  </div>
                  {/* 이미지는 중앙 피드에서만 표시 — 여기선 텍스트 위주로 */}
                  {msg.image_url && !msg.content && (
                    <div style={{ fontSize: 'clamp(11px,0.85vw,16px)', color: inkSoft, fontStyle: 'italic', marginBottom: 4 }}>📷 이미지 메시지</div>
                  )}
                  {msg.content && <p style={{ fontSize: 'clamp(12px,0.95vw,19px)', lineHeight: 1.5, color: '#333', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', fontWeight: 400 } as React.CSSProperties}>
                    {msg.content}
                  </p>}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* 하단 바 */}
      <footer style={{
        flexShrink: 0, zIndex: 10,
        borderTop: `1px solid rgba(0,0,0,0.07)`, padding: '8px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.95)',
        width: '100%',
      }}>
        <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, letterSpacing: '0.08em', textAlign: 'center' }}>
          농인부 & 사랑부를 위해 기도해주세요.
        </span>
      </footer>
    </div>
  );
}
