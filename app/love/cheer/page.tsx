'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PiHandsPrayingFill } from 'react-icons/pi';

interface Message {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  likes_count: number;
}

const POLL_MS       = 10_000;
const MAX_FEED      = 40;
const MAX_NEW_PANEL = 4;

// 스테퍼
const VISIBLE = 12;   // 보여줄 슬롯 수
const STEP_MS = 3000; // 한 칸 대기(ms)
const ANIM_MS = 380;  // 이동 애니메이션(ms)

// 뷰포트 높이 기반으로 슬롯 높이 계산
function calcSlotH() {
  if (typeof window === 'undefined') return 90;
  return Math.max(72, Math.min(180, Math.floor((window.innerHeight - 40) / VISIBLE)));
}

const CONFETTI_COLORS = ['#ff4d6d','#ff9a3c','#ffd60a','#4ade80','#60a5fa','#a78bfa','#f472b6','#34d399','#fb923c','#38bdf8'];
const CONFETTI_ANIMS  = ['confettiPopA','confettiPopB','confettiPopC','confettiPopD','confettiPopE','confettiPopF','confettiPopG','confettiPopH'];

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
interface SlotItem  { msg: Message; uid: string; }

/* ── 말풍선 ── */
function ChatBubble({ msg, isNew, slotH }: { msg: Message; isNew: boolean; slotH: number }) {
  const h      = hashId(msg.id);
  const isLeft = h % 2 === 0;

  // 슬롯 높이에 비례한 폰트/패딩 스케일
  const scale = slotH / 90;
  const fs = (base: number) => Math.round(base * scale);

  return (
    <div style={{
      height: slotH,
      display: 'flex', flexDirection: 'column',
      alignItems: isLeft ? 'flex-start' : 'flex-end',
      justifyContent: 'center',
      padding: `0 ${fs(28)}px`,
    }}>
      {/* 이름 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: fs(6), marginBottom: fs(4),
        flexDirection: isLeft ? 'row' : 'row-reverse',
      }}>
        <span style={{ fontSize: fs(13), fontWeight: 700, color: inkMid }}>{msg.author_name}</span>
        {isNew && (
          <span style={{ background: '#e94545', color: '#fff', fontSize: fs(9), fontWeight: 800, letterSpacing: '0.1em', padding: `${fs(2)}px ${fs(7)}px`, borderRadius: 10 }}>NEW</span>
        )}
        {msg.likes_count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: fs(12), color: accentD }}>
            <PiHandsPrayingFill size={fs(11)} color={accent} /> {msg.likes_count}
          </span>
        )}
      </div>

      {/* 버블 + 꼬리 */}
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '60%' }}>
        {/* 꼬리 */}
        <div style={{
          position: 'absolute', bottom: -fs(9),
          ...(isLeft ? { left: fs(14) } : { right: fs(14) }),
          width: 0, height: 0,
          borderLeft:  isLeft ? '0 solid transparent'   : `${fs(13)}px solid transparent`,
          borderRight: isLeft ? `${fs(13)}px solid transparent` : '0 solid transparent',
          borderTop: `${fs(10)}px solid #ffffff`,
          filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.05))',
        }} />
        {/* 버블 */}
        <div style={{
          background: '#ffffff',
          borderRadius: isLeft ? `${fs(5)}px ${fs(20)}px ${fs(20)}px ${fs(20)}px` : `${fs(20)}px ${fs(5)}px ${fs(20)}px ${fs(20)}px`,
          padding: `${fs(10)}px ${fs(16)}px`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          <p style={{
            fontSize: fs(17), lineHeight: 1.55, color: ink,
            margin: 0, fontWeight: 400,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          } as React.CSSProperties}>
            {msg.content}
          </p>
        </div>
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
  const [timeStr, setTimeStr]           = useState('');
  const [particles, setParticles]       = useState<Particle[]>([]);
  const [burstMsg, setBurstMsg]         = useState<Message | null>(null);
  const [burstLeave, setBurstLeave]     = useState(false);

  // 뷰포트 기반 슬롯 높이
  const [slotH, setSlotH]       = useState(90);
  const slotHRef                = useRef(90);

  // 스테퍼
  const [slots, setSlots]       = useState<SlotItem[]>([]);
  const [offset, setOffset]     = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const allMsgsRef  = useRef<Message[]>([]);
  const headRef     = useRef(0);
  const uidRef      = useRef(0);
  const initialized = useRef(false);
  const stepReady   = useRef(false); // 초기화 완료 후에만 스텝 허용

  const prevIds = useRef<Set<string>>(new Set());
  const pid     = useRef(0);

  /* ── 뷰포트 크기에 따른 slotH 계산 ── */
  useEffect(() => {
    const update = () => {
      const h = calcSlotH();
      slotHRef.current = h;
      setSlotH(h);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /* ── 스테퍼 초기화 ── */
  useEffect(() => {
    allMsgsRef.current = [...latest];
    if (!initialized.current && latest.length > 0) {
      initialized.current = true;
      const count = VISIBLE + 1;
      setSlots(Array.from({ length: count }, (_, i) => ({
        msg: latest[i % latest.length],
        uid: String(uidRef.current++),
      })));
      headRef.current = count;
      setTimeout(() => { stepReady.current = true; }, STEP_MS);
    }
  }, [latest]);

  /* ── 한 칸씩 올라가는 스텝 ── */
  const doStep = useCallback(() => {
    if (!stepReady.current || allMsgsRef.current.length === 0) return;

    setIsMoving(true);
    setOffset(-slotHRef.current);

    setTimeout(() => {
      const nextMsg = allMsgsRef.current[headRef.current % allMsgsRef.current.length];
      headRef.current++;
      setIsMoving(false);
      setOffset(0);
      setSlots(prev => [...prev.slice(1), { msg: nextMsg, uid: String(uidRef.current++) }]);
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

      const newMsg = msgs.find((m: Message) => added.includes(m.id));
      if (newMsg) {
        setBurstLeave(false);
        setBurstMsg(newMsg);
        setTimeout(() => setBurstLeave(true), 5000);
        setTimeout(() => setBurstMsg(null), 5700);
        setNewPanelMsgs(prev => [newMsg, ...prev].slice(0, MAX_NEW_PANEL));
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
    const tick = () => setTimeStr(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: '#f5f3f0',
      color: ink, fontFamily: 'var(--font-noto-sans)', fontWeight: 400,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>

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
                <p style={{ fontSize: 19, lineHeight: 1.9, color: ink, margin: '0 0 16px', textAlign: 'center', fontWeight: 500 }}>
                  {burstMsg.content}
                </p>
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
              <div style={{ fontSize: 'clamp(13px,1.1vw,22px)', fontWeight: 700, color: accentD, letterSpacing: '0.1em' }}>동광교회 사랑부</div>
              <div style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, marginTop: 1 }}>응원메세지 🙏</div>
            </div>
          </div>

          <div style={{ alignSelf: 'flex-start', fontSize: 'clamp(10px,0.75vw,15px)', letterSpacing: '0.3em', fontWeight: 700, color: accent, background: 'rgba(201,168,76,0.1)', padding: '4px 12px', borderRadius: 20 }}>
            ✦ 인기 응원
          </div>

          {best[0] ? (
            <div style={{
              background: 'linear-gradient(135deg,#fffdf5,#fff8e8)',
              border: `2px solid rgba(201,168,76,0.3)`,
              borderRadius: 16, padding: 'clamp(12px,1.2vh,20px) clamp(14px,1.2vw,22px)', flexShrink: 0,
              boxShadow: '0 4px 20px rgba(201,168,76,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 'clamp(18px,1.8vw,32px)' }}>👑</span>
                <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', fontWeight: 700, color: accentD, letterSpacing: '0.2em' }}>1위</span>
              </div>
              <p style={{ fontSize: 'clamp(14px,1.1vw,22px)', lineHeight: 1.8, color: ink, margin: '0 0 10px', fontWeight: 500 }}>{best[0].content}</p>
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
                <p style={{ fontSize: 'clamp(12px,0.95vw,19px)', lineHeight: 1.6, color: inkMid, margin: '0 0 4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{msg.content}</p>
                <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft }}>— {msg.author_name}</span>
              </div>
            ))}
          </div>

          <div style={{ paddingTop: 10, borderTop: `1px solid rgba(0,0,0,0.06)`, fontSize: 'clamp(10px,0.75vw,15px)', color: inkSoft, lineHeight: 1.9, textAlign: 'center', opacity: 0.7 }}>
            "이같이 너희 빛이 사람 앞에 비치게 하여 그들로 너희 착한 행실을 보고
            하늘에 계신 너희 아버지께 영광을 돌리게 하라" — 마태복음 5:16
          </div>
        </aside>

        {/* ══ 가운데: 스테퍼 피드 ══ */}
        <main style={{ flex: 2, position: 'relative', overflow: 'hidden' }}>

          {/* 상단 페이드 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom,#f5f3f0,transparent)', pointerEvents: 'none', zIndex: 10 }} />

          {/* 슬롯 컨테이너 — 화면 꽉 채움, overflow는 main이 clip */}
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <div style={{
              transform: `translateY(${offset}px)`,
              // 스프링 느낌: 약간 오버슈트 후 안착
              transition: isMoving
                ? `transform ${ANIM_MS}ms cubic-bezier(0.34,1.15,0.64,1)`
                : 'none',
              willChange: 'transform',
            }}>
              {slots.map(item => (
                <ChatBubble key={item.uid} msg={item.msg} isNew={newIds.has(item.msg.id)} slotH={slotH} />
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
        <aside style={{
          flex: 1, minWidth: 0,
          borderLeft: `1px solid rgba(0,0,0,0.08)`,
          padding: 'clamp(14px,1.4vh,24px) clamp(12px,1vw,24px)',
          display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1vh,18px)',
          background: '#ffffff', overflow: 'hidden',
        }}>

          {/* 전자시계 */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: 'clamp(12px,1.2vh,20px) clamp(14px,1.2vw,22px)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 'clamp(22px,2.2vw,48px)', fontFamily: "'Courier New','Lucida Console',monospace",
              color: ink, letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums', fontWeight: 700, lineHeight: 1,
              textAlign: 'center',
            }}>
              {timeStr}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#e94545',
                animationName: 'livePulse', animationDuration: '2s',
                animationTimingFunction: 'ease', animationIterationCount: 'infinite',
              }} />
              <span style={{ fontSize: 'clamp(10px,0.75vw,15px)', color: inkSoft, letterSpacing: '0.25em', fontWeight: 600 }}>LIVE</span>
              {total > 0 && (
                <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft }}>
                  · 응원 <b style={{ color: inkMid }}>{total}</b>개
                </span>
              )}
            </div>
          </div>

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
                  <div style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, marginBottom: 4 }}>현재까지 응원</div>
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
                    {i === 0 && <span style={{ background: '#e94545', color: '#fff', fontSize: 'clamp(9px,0.7vw,13px)', fontWeight: 800, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 8 }}>NEW</span>}
                    <span style={{ fontSize: 'clamp(12px,1vw,20px)', fontWeight: 700, color: ink }}>{msg.author_name}</span>
                  </div>
                  <p style={{ fontSize: 'clamp(12px,0.95vw,19px)', lineHeight: 1.5, color: inkMid, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' } as React.CSSProperties}>
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* 하단 바 */}
      <footer style={{
        flexShrink: 0, zIndex: 10,
        borderTop: `1px solid rgba(0,0,0,0.07)`, padding: '7px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.95)',
      }}>
        <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, letterSpacing: '0.05em' }}>
          (06959) 서울특별시 동작구 성대로1길 26 제2교육관 갈리리홀 · 주일 오후 12시
        </span>
        <span style={{ fontSize: 'clamp(11px,0.85vw,17px)', color: inkSoft, opacity: 0.55 }}>
          매달 4번째 주는 열린예배 · 동광교회 사랑부
        </span>
      </footer>
    </div>
  );
}
