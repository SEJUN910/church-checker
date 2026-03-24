'use client';

import { useState, useEffect, useRef } from 'react';
import { PiHandsPrayingFill } from 'react-icons/pi';

interface Message {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  likes_count: number;
}

const POLL_MS   = 10_000;
const PARTICLES = ['🙏','✨','💛','⭐','🌟','💫','🎉','💕','🕊️','✝️','🎊','🌈'];

// 풍선 색상 팔레트
const BALLOON_COLORS = [
  { top: '#ff9eb5', bot: '#ff5a87', dark: '#d93a6a', text: '#fff', shadow: 'rgba(255,90,135,0.4)' },
  { top: '#7ec8e3', bot: '#3aa8d4', dark: '#1e82b0', text: '#fff', shadow: 'rgba(58,168,212,0.4)' },
  { top: '#c8b4ff', bot: '#9b6dff', dark: '#7845e0', text: '#fff', shadow: 'rgba(155,109,255,0.4)' },
  { top: '#b4f0c8', bot: '#5dd68a', dark: '#2eb865', text: '#fff', shadow: 'rgba(93,214,138,0.4)' },
  { top: '#ffd8a8', bot: '#ffab5e', dark: '#e0823a', text: '#fff', shadow: 'rgba(255,171,94,0.4)' },
  { top: '#ffe066', bot: '#ffc61a', dark: '#c89a00', text: '#7a5a00', shadow: 'rgba(255,192,26,0.4)' },
  { top: '#f9a8d4', bot: '#ec4899', dark: '#be185d', text: '#fff', shadow: 'rgba(236,72,153,0.4)' },
  { top: '#a5f3fc', bot: '#22d3ee', dark: '#0891b2', text: '#fff', shadow: 'rgba(34,211,238,0.4)' },
];

const BALLOON_X     = [8, 22, 38, 54, 68, 82, 15, 46, 72, 30, 60, 85, 20, 50, 76, 10];
const BALLOON_ANIMS = ['balloonRiseA','balloonRiseB','balloonRiseC','balloonRiseD','balloonRiseE','balloonRiseF'];
const BALLOON_DURS  = [22, 26, 20, 28, 24, 19, 25, 23, 27, 21, 29, 18, 24, 22, 26, 20];

// 메세지 ID → 안정적인 숫자 (폴링 후 배열 순서 바뀌어도 동일한 값 유지)
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const accent  = '#7c5cfc';   // 소프트 바이올렛
const accentD = '#4c3aaa';   // 진한 바이올렛
const ink     = '#1a1830';   // 짙은 네이비 (고대비)
const inkMid  = '#2d2b50';   // 중간 네이비
const inkSoft = '#5a5880';   // 소프트 퍼플-그레이

interface Particle { id: number; x: number; emoji: string; delay: number; dur: number; }

function BalloonCard({ msg, colorIdx, isNew }: { msg: Message; colorIdx: number; isNew: boolean }) {
  const c = isNew
    ? { top: '#ffe066', bot: '#ffab5e', dark: '#c87800', text: '#5a3000', shadow: 'rgba(255,171,94,0.6)' }
    : BALLOON_COLORS[colorIdx % BALLOON_COLORS.length];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 풍선 몸체 */}
      <div style={{
        width: 195,
        minHeight: 175,
        background: `radial-gradient(circle at 35% 30%, ${c.top}, ${c.bot})`,
        borderRadius: '50% 50% 50% 50% / 44% 44% 56% 56%',
        padding: '22px 16px 20px',
        boxShadow: `4px 8px 28px ${c.shadow}, inset 0 -4px 8px rgba(0,0,0,0.1)`,
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6,
      }}>
        {/* 빛 반사 */}
        <div style={{
          position: 'absolute', top: '12%', left: '18%',
          width: '32%', height: '20%',
          background: 'rgba(255,255,255,0.45)',
          borderRadius: '50%',
          transform: 'rotate(-25deg)',
          animationName: 'highlightShine', animationDuration: '3s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', top: '20%', left: '24%',
          width: '14%', height: '10%',
          background: 'rgba(255,255,255,0.35)',
          borderRadius: '50%',
          transform: 'rotate(-20deg)',
        }} />

        {/* NEW 뱃지 */}
        {isNew && (
          <div style={{
            position: 'absolute', top: -10, right: -8,
            background: '#e94545', color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            padding: '3px 8px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(233,69,69,0.5)',
          }}>NEW</div>
        )}

        {/* 내용 */}
        
        <div style={{
          fontSize: 16, color: c.text, opacity: 0.85, fontWeight: 500,
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}>
          # {msg.author_name}
          {msg.likes_count > 0 && (
            <span style={{ marginLeft: 6, opacity: 0.9 }}>
              🙏{msg.likes_count}
            </span>
          )}
        </div>

        <p style={{
          fontSize: 14, lineHeight: 1.7, color: c.text,
          margin: 0, textAlign: 'center', fontWeight: 400,
          textShadow: '0 1px 2px rgba(0,0,0,0.15)',
          maxWidth: 158,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {msg.content}
        </p>
      </div>

      {/* 매듭 */}
      <div style={{
        width: 10, height: 10,
        background: c.bot,
        borderRadius: '0 0 40% 40%',
        boxShadow: `0 2px 4px ${c.shadow}`,
        marginTop: -1,
      }} />
      {/* 실 */}
      <div style={{
        width: 1.5, height: 45,
        background: `linear-gradient(to bottom, ${c.dark} 0%, rgba(0,0,0,0.08) 100%)`,
      }} />
    </div>
  );
}

export default function CheerPage() {
  const [latest, setLatest]         = useState<Message[]>([]);
  const [best, setBest]             = useState<Message[]>([]);
  const [newIds, setNewIds]         = useState<Set<string>>(new Set());
  const [total, setTotal]           = useState(0);
  const [spotIdx, setSpotIdx]       = useState(0);
  const [timeStr, setTimeStr]       = useState('');
  const [particles, setParticles]   = useState<Particle[]>([]);
  const [burstMsg, setBurstMsg]     = useState<Message | null>(null);
  const [burstLeave, setBurstLeave] = useState(false);
  const prevIds = useRef<Set<string>>(new Set());
  const pid     = useRef(0);

  const fetchData = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/love/messages?page=1&sort=latest'),
      fetch('/api/love/messages?page=1&sort=likes'),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    const msgs: Message[]    = j1.data || [];
    const topMsgs: Message[] = (j2.data || []).slice(0, 3);

    const curIds = new Set(msgs.map(m => m.id));
    const added  = [...curIds].filter(id => prevIds.current.size > 0 && !prevIds.current.has(id));

    if (added.length > 0) {
      setNewIds(prev => new Set([...prev, ...added]));

      // 파티클 16개
      const newP: Particle[] = Array.from({ length: 16 }, () => ({
        id: pid.current++,
        x: 5 + Math.random() * 88,
        emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)],
        delay: Math.random() * 1.2,
        dur: 2.0 + Math.random() * 1.5,
      }));
      setParticles(p => [...p, ...newP]);
      setTimeout(() => setParticles(p => p.filter(pp => !newP.find(np => np.id === pp.id))), 4500);

      // 중앙 팡
      const newMsg = msgs.find(m => added.includes(m.id));
      if (newMsg) {
        setBurstLeave(false);
        setBurstMsg(newMsg);
        setTimeout(() => setBurstLeave(true), 3200);
        setTimeout(() => setBurstMsg(null), 3900);
      }
      // NEW 뱃지 3분 유지 후 제거
      setTimeout(() => setNewIds(prev => {
        const next = new Set(prev);
        added.forEach(id => next.delete(id));
        return next;
      }), 3 * 60 * 1000);
    }

    prevIds.current = curIds;
    setLatest(msgs.slice(0, 16));
    setBest(topMsgs);
    setTotal(j1.total || 0);
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (best.length < 2) return;
    const iv = setInterval(() => setSpotIdx(i => (i + 1) % best.length), 7000);
    return () => clearInterval(iv);
  }, [best.length]);

  useEffect(() => {
    const tick = () => setTimeStr(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const spot = best[spotIdx];


  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(160deg,#f0f4ff 0%,#ece8ff 50%,#edfdf8 100%)',
      color: ink, fontFamily: 'var(--font-noto-sans)', fontWeight: 300,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>

      {/* 배경 원형 빛 */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { top: '-10%', left: '-5%', size: 500, c: 'rgba(255,90,135,0.08)', a: 'floatA', d: '9s' },
          { bottom: '-15%', right: '-5%', size: 560, c: 'rgba(58,168,212,0.09)', a: 'floatB', d: '11s' },
          { top: '30%', left: '40%', size: 340, c: 'rgba(124,92,252,0.07)', a: 'floatC', d: '13s' },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', ...o as any,
            width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
            animationName: o.a, animationDuration: o.d,
            animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          }} />
        ))}
      </div>

      {/* 파티클 */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'fixed', bottom: 50, left: `${p.x}%`, zIndex: 300,
          fontSize: 26, pointerEvents: 'none',
          animationName: 'particleFloat', animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`, animationTimingFunction: 'ease-out', animationFillMode: 'forwards',
        }}>{p.emoji}</div>
      ))}

      {/* ── 중앙 팡 오버레이 ── */}
      {burstMsg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.22)', backdropFilter: 'none',
          animationName: burstLeave ? 'overlayOut' : 'overlayIn',
          animationDuration: burstLeave ? '0.7s' : '0.3s', animationFillMode: 'forwards',
        }}>
          {/* 링 3개 */}
          {!burstLeave && [140, 210, 290].map((size, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: size, height: size, borderRadius: '50%',
              border: `3px solid rgba(124,92,252,${0.7 - i * 0.2})`,
              animationName: 'ringPop',
              animationDuration: `${0.7 + i * 0.2}s`,
              animationDelay: `${i * 0.1}s`, animationFillMode: 'forwards',
            }} />
          ))}

          {/* 큰 풍선 카드 */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animationName: burstLeave ? 'burstOut' : 'burstIn',
            animationDuration: burstLeave ? '0.7s' : '0.7s',
            animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)', animationFillMode: 'forwards',
          }}>
            {/* 큰 풍선 */}
            <div style={{
              width: 320, minHeight: 240,
              background: 'radial-gradient(circle at 32% 28%, #ffe8a0, #ffb340)',
              borderRadius: '50% 50% 50% 50% / 44% 44% 56% 56%',
              padding: '36px 28px 30px',
              boxShadow: '6px 12px 48px rgba(255,171,64,0.5), inset 0 -6px 12px rgba(0,0,0,0.1)',
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{
                position: 'absolute', top: '10%', left: '16%',
                width: '30%', height: '18%',
                background: 'rgba(255,255,255,0.5)', borderRadius: '50%', transform: 'rotate(-25deg)',
              }} />
              <div style={{
                position: 'absolute', top: -16, right: -12,
                background: '#e94545', color: '#fff',
                fontSize: 12, fontWeight: 800, letterSpacing: '0.15em',
                padding: '5px 14px', borderRadius: 20,
                boxShadow: '0 4px 12px rgba(233,69,69,0.5)',
                animationName: 'crownWiggle', animationDuration: '1.5s',
                animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
              }}>NEW ✨</div>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🎉</div>
              <p style={{
                fontSize: 17, lineHeight: 1.85, color: '#5a3200',
                margin: 0, textAlign: 'center', fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.08)', maxWidth: 260,
              }}>
                {burstMsg.content}
              </p>
              <div style={{ fontSize: 13, color: '#7a5000', fontWeight: 600, marginTop: 4 }}>
                — {burstMsg.author_name}
                {burstMsg.likes_count > 0 && <span style={{ marginLeft: 8 }}>🙏 {burstMsg.likes_count}</span>}
              </div>
            </div>
            {/* 매듭 + 실 */}
            <div style={{ width: 14, height: 14, background: '#e8900a', borderRadius: '0 0 50% 50%', marginTop: -2 }} />
            <div style={{ width: 2, height: 60, background: 'linear-gradient(to bottom,#e8900a,rgba(0,0,0,0.1))' }} />
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <header style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 36px',
        background: 'rgba(240,244,255,0.97)', backdropFilter: 'none',
        borderBottom: `1px solid rgba(140,120,220,0.2)`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo/dk_logo.png" alt="" style={{ height: 20, objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: accentD, letterSpacing: '0.15em' }}>동광교회 사랑부</span>
          <div style={{ width: 1, height: 16, background: 'rgba(124,92,252,0.3)' }} />
          <span style={{ fontSize: 19, fontWeight: 400, color: ink }}>응원메세지 🙏</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {total > 0 && (
            <span style={{ fontSize: 13, color: inkSoft }}>
              총 <b style={{ color: accentD, fontSize: 15 }}>{total}</b>개의 응원
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%', background: '#e94545',
              animationName: 'livePulse', animationDuration: '2s',
              animationTimingFunction: 'ease', animationIterationCount: 'infinite',
            }} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', color: inkSoft, fontWeight: 600 }}>LIVE</span>
          </div>
          <span style={{ fontSize: 21, fontWeight: 300, color: ink, fontVariantNumeric: 'tabular-nums', minWidth: 94, textAlign: 'right' }}>
            {timeStr}
          </span>
        </div>
      </header>

      {/* ── 본문 ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ══ 좌측: 베스트 스포트라이트 ══ */}
        <aside style={{
          width: 340, flexShrink: 0,
          borderRight: `1px solid rgba(140,120,220,0.18)`,
          padding: '22px 20px',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(232,228,255,0.75)', backdropFilter: 'none',
          overflow: 'hidden',
        }}>
          <div style={{
            alignSelf: 'flex-start', marginBottom: 16,
            fontSize: 9, letterSpacing: '0.3em', fontWeight: 700, color: accent,
            background: 'rgba(124,92,252,0.1)', padding: '4px 12px', borderRadius: 20,
          }}>✦ 인기 응원메세지</div>

          {spot ? (
            <div key={spot.id} style={{
              position: 'relative', overflow: 'hidden', flexShrink: 0,
              background: '#ffffff',
              border: `2px solid rgba(140,120,220,0.25)`,
              borderRadius: 20, padding: '24px 22px 20px',
              boxShadow: '0 4px 24px rgba(124,92,252,0.14), 0 8px 32px rgba(0,0,0,0.07)',
            }}>
              {/* shimmer 줄 */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent,${accent},transparent)`, overflow: 'hidden' }}>
                <div style={{ width: '40%', height: '100%', background: 'rgba(255,255,255,0.8)', animationName: 'shimmerSlide', animationDuration: '2s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} />
              </div>
              <div style={{ fontSize: 34, textAlign: 'center', marginBottom: 6, animationName: 'crownWiggle', animationDuration: '2.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }}>👑</div>
              <div style={{ textAlign: 'center', fontSize: 9, letterSpacing: '0.3em', fontWeight: 700, color: accentD, marginBottom: 12 }}>
                {spotIdx === 0 ? '🥇 1위' : spotIdx === 1 ? '🥈 2위' : '🥉 3위'}
              </div>
              <div style={{ position: 'relative', padding: '0 6px' }}>
                <span style={{ fontSize: 38, color: 'rgba(124,92,252,0.2)', lineHeight: 1, position: 'absolute', top: -8, left: 0, fontFamily: 'serif' }}>"</span>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: ink, margin: 0, fontWeight: 500, paddingLeft: 22 }}>{spot.content}</p>
                <span style={{ fontSize: 38, color: 'rgba(124,92,252,0.2)', lineHeight: 1, position: 'absolute', bottom: -16, right: 0, fontFamily: 'serif' }}>"</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 12, borderTop: `1px solid rgba(124,92,252,0.18)` }}>
                <span style={{ fontSize: 12, color: inkMid, fontWeight: 600 }}>— {spot.author_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(124,92,252,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                  <PiHandsPrayingFill size={15} color={accent} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: accentD }}>{spot.likes_count}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: inkSoft, fontSize: 13, textAlign: 'center', padding: '60px 0' }}>불러오는 중…</div>
          )}

          {best.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {best.map((_, i) => (
                <div key={i} onClick={() => setSpotIdx(i)} style={{
                  width: i === spotIdx ? 22 : 6, height: 6, borderRadius: 3,
                  background: i === spotIdx ? accent : 'rgba(124,92,252,0.2)',
                  transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)', cursor: 'pointer',
                }} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, flex: 1, overflow: 'hidden' }}>
            {best.filter((_, i) => i !== spotIdx).map(msg => (
              <div key={msg.id} onClick={() => setSpotIdx(best.findIndex(b => b.id === msg.id))}
                style={{ background: '#ffffff', border: `1px solid rgba(124,92,252,0.18)`, borderRadius: 12, padding: '10px 13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 12, lineHeight: 1.65, color: inkMid, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{msg.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: inkSoft, fontWeight: 500 }}>{msg.author_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: accent, fontSize: 11 }}>
                    <PiHandsPrayingFill size={11} /><span>{msg.likes_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid rgba(124,92,252,0.12)`, fontSize: 10, color: inkSoft, lineHeight: 1.9, textAlign: 'center', opacity: 0.75 }}>
            "이같이 너희 빛이 사람 앞에 비치게 하여 그들로 너희 착한 행실을 보고 하늘에 계신 너희 아버지께 영광을 돌리게 하라"<br />— 마태복음 5:16
          </div>
        </aside>

        {/* ══ 우측: 풍선 레인 ══ */}
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* 풍선들 - ID 기반으로 안정적인 파라미터 */}
          {latest.map((msg) => {
            const h      = hashId(msg.id);
            const isNew  = newIds.has(msg.id);
            const x      = BALLOON_X[h % BALLOON_X.length];
            const anim   = BALLOON_ANIMS[h % BALLOON_ANIMS.length];
            const dur    = BALLOON_DURS[h % BALLOON_DURS.length];
            const delay  = -((h % 100) / 100) * dur; // 0~dur 사이 안정적인 오프셋

            return (
              <div key={msg.id} style={{
                position: 'absolute',
                top: '100%',
                left: `${x}%`,
                transform: 'translateX(-50%)',
                animationName: anim,
                animationDuration: `${dur}s`,
                animationDelay: `${delay}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                willChange: 'transform',
                zIndex: isNew ? 5 : 1,
              }}>
                <BalloonCard msg={msg} colorIdx={h} isNew={isNew} />
              </div>
            );
          })}

          {/* 위아래 페이드 마스크 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, pointerEvents: 'none', background: 'linear-gradient(to bottom,rgba(240,244,255,1),transparent)', zIndex: 10 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, pointerEvents: 'none', background: 'linear-gradient(to top,rgba(237,244,255,1),transparent)', zIndex: 10 }} />

          {/* 중앙 안내 (메세지 없을 때) */}
          {latest.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkSoft, fontSize: 14 }}>
              응원메세지를 기다리고 있어요 🙏
            </div>
          )}
        </main>
      </div>

      {/* 하단 바 */}
      <footer style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        borderTop: `1px solid rgba(140,120,220,0.15)`, padding: '9px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(236,232,255,0.97)', backdropFilter: 'none',
      }}>
        <span style={{ fontSize: 10, color: inkSoft, letterSpacing: '0.08em' }}>
          (06959) 서울특별시 동작구 성대로1길 26 제2교육관 갈리리홀 · 주일 오후 12시
        </span>
        <span style={{ fontSize: 10, color: inkSoft, opacity: 0.6 }}>
          매달 4번째 주는 열린예배 · 동광교회 사랑부
        </span>
      </footer>
    </div>
  );
}
