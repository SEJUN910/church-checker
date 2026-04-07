'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { PiHandsPrayingFill, PiHandsPraying } from 'react-icons/pi';

interface PrayerItem {
  id: string;
  title: string;
  content: string;
  category: string;
  theme_verse: string | null;
  created_at: string;
}

interface Message {
  id: string;
  author_name: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
}

async function compressImage(file: File, maxBytes = 5 * 1024 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1920;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      let quality = 0.92;
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('압축 실패'));
          if (blob.size <= maxBytes || quality <= 0.3) return resolve(blob);
          quality -= 0.1;
          tryCompress();
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };
    img.onerror = reject;
    img.src = url;
  });
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
  borderRadius: '0 8px 8px 0',
  padding: '18px 20px',
  marginBottom: 10,
  boxShadow: '0 2px 12px rgba(184,154,90,0.08)',
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: 12, 
  marginBottom: 16 // 여백을 조금 더 주어 시원하게 배치
}}>
  {/* 십자가 아이콘 영역 */}
  <div style={{
    width: 24, height: 24, 
    border: `1.2px solid ${gold}`, // 선 두께를 살짝 올림
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: gold, flexShrink: 0,
  }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* 정통 십자가 비율: 가로선을 위쪽(y=9)으로 배치 */}
      <path d="M12 3v18M6 9h12"/>
    </svg>
  </div>

  {/* 제목 영역 */}
  <h2 style={{
    fontFamily: 'var(--font-noto-serif)', 
    fontSize: 18, // 가독성을 위해 살짝 키움
    fontWeight: 500, // Serif 서체는 600 정도가 고급스러움
    color: ink, 
    letterSpacing: '-0.01em', // Serif는 자간을 살짝 좁히는 게 예쁨
    whiteSpace: 'nowrap',
    margin: 0,
  }}>
    {title}
  </h2>

  {/* 오른쪽 장식 선 */}
  <div style={{ 
    flex: 1, 
    height: '1px', 
    background: `linear-gradient(to right, ${gold}44, transparent)`, // 골드에 투명도(44)를 주어 은은하게
    marginLeft: 8 
  }} />
</div>
  );
}

const RANDOM_NAMES = [
  '다니엘', '한나', '엘리야', '느헤미야', '에스더', '다윗', '솔로몬', '야곱', '모세',
  '사랑', '희락', '화평', '오래 참음', '자비', '양선', '충성', '온유', '절제',
];

type DeptTab = '농인부' | '사랑부';

export default function LovePage() {
  const [deptTab, setDeptTab]       = useState<DeptTab>('농인부');
  const [prayers, setPrayers]       = useState<PrayerItem[]>([]);
  const [prayerLoading, setPrayerLoading] = useState(true);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dk_author_name');
      if (saved) return saved;
    }
    return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  });
  const [content, setContent]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef             = useRef(false);
  const [likedIds, setLikedIds]     = useState<Set<string>>(new Set());
  const [poppingId, setPoppingId]   = useState<string | null>(null);
  const [sort, setSort]             = useState<'latest' | 'likes'>('latest');

  const supabase = createClient();

  useEffect(() => {
    if (!localStorage.getItem('dk_anon_id')) {
      localStorage.setItem('dk_anon_id', crypto?.randomUUID());
    }
    const saved = localStorage.getItem('dk_liked_messages');
    if (saved) setLikedIds(new Set(JSON.parse(saved)));
    loadPrayers();

    setDeptTab(() => Math.random() < 0.5 ? '농인부' : '사랑부')
  }, []);

  useEffect(() => { loadMessages(1, sort); }, [sort]);

  const loadPrayers = async () => {
    try {
      const { data } = await supabase
        .from('public_prayer_wall')
        .select('id, title, content, category, created_at, theme_verse')
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      setPrayers(data || []);
    } finally {
      setPrayerLoading(false);
    }
  };

  const loadMessages = async (p: number, s: 'latest' | 'likes' = sort) => {
    if (p === 1) setMsgLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/love/messages?page=${p}&sort=${s}`);
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

  const handleLike = async (msgId: string) => {
    const liked = likedIds.has(msgId);
    const newLiked = new Set(likedIds);
    if (liked) newLiked.delete(msgId); else newLiked.add(msgId);
    setLikedIds(newLiked);
    localStorage.setItem('dk_liked_messages', JSON.stringify([...newLiked]));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likes_count: m.likes_count + (liked ? -1 : 1) } : m));
    if (!liked) { setPoppingId(msgId); setTimeout(() => setPoppingId(null), 400); }
    await fetch(`/api/love/messages/${msgId}/like`, { method: liked ? 'DELETE' : 'POST' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        setUploadingImg(true);
  
        let finalBlob: Blob = imageFile;

        // 1. 만약 handleImageSelect에서 변환되지 않은 HEIC가 넘어왔을 경우를 대비한 안전장치
        if (imageFile.name.toLowerCase().endsWith('.heic') || imageFile.type === 'image/heic') {
          try {
            const heic2any = (await import("heic2any")).default;
            const converted = await heic2any({ blob: imageFile, toType: "image/jpeg", quality: 0.7 });
            finalBlob = Array.isArray(converted) ? converted[0] : converted;
          } catch (e) {
            console.error("HEIC 최종 변환 실패:", e);
          }
        }

        // 만약 compressImage 내부에서 에러가 난다면 이 함수를 점검해야 합니다.
        const blob = await compressImage(finalBlob as File);         
        const ext = 'jpg';
        const path = `love/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('picnic-images')
          .upload(path, blob, { 
            contentType: 'image/jpeg', // 타입을 명시적으로 jpeg로 고정
            cacheControl: '3600',
            upsert: true 
          });
    
        // setUploadingImg(true);
        // const blob = await compressImage(imageFile);
        // const ext = 'jpg';
        // const path = `love/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        // const { data: uploadData, error: uploadError } = await supabase.storage
        //   .from('picnic-images')
        //   .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        setUploadingImg(false);

        if (uploadError) { toast.error('이미지 업로드 실패'); return; }
        const { data: { publicUrl } } = supabase.storage.from('picnic-images').getPublicUrl(uploadData.path);
        image_url = publicUrl;
      
      }
      const res = await fetch('/api/love/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: authorName, content, image_url }),
      });
      if (!res.ok) throw new Error();
      const created: Message = await res.json();
      localStorage.setItem('dk_author_name', authorName.trim() || created.author_name);
      setMessages(prev => [created, ...prev]);
      setTotal(prev => prev + 1);
      setContent('');
      removeImage();
      setModalOpen(false);
      toast.success('응원메세지를 남겼습니다');
    } catch {
      toast.error('잠시 후 다시 시도해주세요');
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;
  //   const preview = URL.createObjectURL(file);
  //   setImagePreview(preview);
  //   setImageFile(file);
  //   e.target.value = '';
  // };
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  let visualFile = file;

  // 1. HEIC 파일인 경우 실행
  if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
    try {
      // 클라이언트 사이드에서만 라이브러리를 동적으로 불러옴
      const heic2any = (await import("heic2any")).default;

      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.7,
      });

      const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      
      visualFile = new File([resultBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (error) {
      console.error("HEIC 변환 실패:", error);
      return;
    }
  }

  // 2. 미리보기 및 상태 업데이트
  const preview = URL.createObjectURL(visualFile);
  setImagePreview(preview);
  setImageFile(visualFile);
  
  e.target.value = '';
};

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const openModal = () => setModalOpen(true);

  const closeModal = () => {
    setModalOpen(false);
    removeImage();
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
            fontSize: 'clamp(16px, 6vw, 20px)',
            fontWeight: 400,
            color: ink, lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div className="anim-fade-up mb-0 flex items-center gap-1" style={{ animationDelay: '0s' }}>
              <img
                src="/logo/dk_logo.png" alt="로고"
                style={{ height: 17, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />동광교회
            </div>
            <div className='mt-2'>농인부 & 사랑부</div>
          </h1>
          {/* <p className="anim-fade-up" style={{
            animationDelay: '0.4s',
            fontFamily: 'var(--font-noto-serif)', fontSize: 13, fontWeight: 400,
            color: inkSoft, lineHeight: 2.2,
          }}>
            "이같이 너희 빛이 사람 앞에 비치게 하여 그들로 너희 착한 행실을 보고 하늘에 계신 너희 아버지께 영광을 돌리게 하라"<br/> — 마태복음 5:16
          </p> */}
          {/* <div className="anim-fade-in" style={{
            animationDelay: '0.55s',
            width: 1, height: 28,
            background: `linear-gradient(to bottom, transparent, ${gold}, transparent)`,
            margin: '20px auto 0',
          }} /> */}
        </header>

        {/* ── 기도제목 섹션 ── */}
        <section className="anim-fade-up" style={{ animationDelay: '0.65s', marginBottom: 52 }}>
          <SectionHeader title="기도제목" />

          {/* 부서 탭 */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${parchment}` }}>
            {(['농인부', '사랑부'] as DeptTab[]).map(dept => (
              <button
                key={dept}
                onClick={() => setDeptTab(dept)}
                style={{
                  padding: '9px 22px', fontSize: 13, fontWeight: deptTab === dept ? 700 : 400,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: deptTab === dept ? ink : inkSoft,
                  borderBottom: deptTab === dept ? `3px solid ${gold}` : '3px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-noto-sans)',
                  letterSpacing: '0.04em',
                }}
              >
                {dept}
              </button>
            ))}
          </div>

          {prayerLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: inkSoft, fontSize: 13 }}>불러오는 중…</div>
          ) : prayers.filter(p => {
                const dept = (['농인부', '사랑부'] as string[]).includes(p.category) ? p.category : p.title;
                return dept === deptTab;
              }).length === 0 ? (
            <div style={{ background: '#fff', border: `1px solid ${parchment}`, borderRadius: 4, padding: 32, textAlign: 'center' }}>
              <p style={{ color: inkSoft, fontSize: 13 }}>아직 기도제목이 없어요</p>
            </div>
          ) : (
            prayers.map((prayer) => {
              if( prayer.category === deptTab ) {
                return (
                  <div key={prayer.id} style={cardBase}>
                    <div
                      className="prose prose-sm max-w-none prayer-content"
                      style={{ fontSize: 14, lineHeight: 1.85, color: inkMid, fontWeight: 500 }}
                      dangerouslySetInnerHTML={{ __html: prayer.content }}
                    />
                    {prayer.theme_verse && (
                      <div style={{
                        marginTop: 14,
                        paddingTop: 12, borderTop: `1px solid ${parchment}`,
                        fontFamily: 'var(--font-noto-serif)', fontSize: 14,
                        color: gold, lineHeight: 1.7,
                      }}>
                        {prayer.theme_verse}
                      </div>
                    )}
                    <div className="text-end" style={{ marginTop: 10, fontSize: 11, color: inkSoft, letterSpacing: '0.04em' }}>
                      {new Date(prayer.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                )
              }
            })
          )}
        </section>

        {/* ── 기도제목 → 응원 CTA ── */}
        {!prayerLoading && prayers.length > 0 && (
          <div
            onClick={openModal}
            style={{
              marginBottom: 40, cursor: 'pointer',
              background: `linear-gradient(135deg, #fffdf7, #f7f0e2)`,
              border: `1px solid ${gold}`,
              borderRadius: 6, padding: '22px 24px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(184,154,90,0.12)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(184,154,90,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(184,154,90,0.12)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `rgba(184,154,90,0.12)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: 20, color: gold,
            }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg></div>
            <p style={{ fontSize: 15, fontWeight: 600, color: ink, marginBottom: 4 }}>기도제목을 읽으셨나요?</p>
            <p style={{ fontSize: 13, color: inkSoft, lineHeight: 1.7, marginBottom: 14 }}>
              짧은 응원 메시지나 기도 한 줄을 남겨주세요.<br />큰 힘이 됩니다 🙏
            </p>
            <span style={{
              display: 'inline-block',
              background: gold, color: '#fff',
              fontSize: 13, fontWeight: 600,
              padding: '9px 24px', borderRadius: 8,
              letterSpacing: '0.06em',
            }}>응원 메시지 남기기 →</span>
          </div>
        )}

        {/* ── 응원메세지 섹션 ── */}
        <section className="anim-fade-up" style={{ animationDelay: '0.8s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 24, height: 24, border: `1px solid ${gold}`, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: gold, flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h2 style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 17, fontWeight: 500, color: ink, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                응원메세지
                {total > 0 && <span style={{ fontSize: 12, color: inkSoft, fontWeight: 400, marginLeft: 8 }}>{total}개</span>}
              </h2>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${parchment}, transparent)` }} />
            </div>
            {/* <button
              onClick={openModal}
              style={{
                flexShrink: 0, marginLeft: 16,
                background: ink, color: cream,
                border: 'none', cursor: 'pointer',
                padding: '8px 18px', borderRadius: 2,
                fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-noto-sans)',
              }}
            >
              메세지 남기기
            </button> */}
          </div>

          {/* 정렬 버튼 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['latest', 'likes'] as const).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 500,
                borderRadius: 8, border: `1px solid ${sort === s ? gold : parchment}`,
                background: sort === s ? gold : 'transparent',
                color: sort === s ? '#fff' : inkSoft,
                cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: 'var(--font-noto-sans)', letterSpacing: '0.04em',
              }}>
                {s === 'latest' ? '최신순' : '아멘순'}
              </button>
            ))}
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
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: inkMid, whiteSpace: 'pre-wrap', margin: 0, fontWeight: 300, wordBreak: 'break-all' }}>
                    {msg.content}
                  </p>
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt=""
                      style={{ marginTop: 10, maxWidth: '100%', borderRadius: 8, display: 'block', cursor: 'zoom-in' }}
                      onClick={() => window.open(msg.image_url!, '_blank')}
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      onClick={() => handleLike(msg.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '2px 0', fontSize: 12,
                        color: likedIds.has(msg.id) ? gold : inkSoft,
                        transition: 'color 0.2s', fontFamily: 'var(--font-noto-sans)',
                      }}
                    >
                      <span className={poppingId === msg.id ? 'heart-pop' : ''} style={{ display: 'flex', alignItems: 'center', fontSize: 17 }}>
                        {likedIds.has(msg.id)
                          ? <PiHandsPrayingFill color="#e94545" />
                          : <PiHandsPraying />}
                      </span>
                      {msg.likes_count > 0 && <span>{msg.likes_count}</span>}
                    </button>
                  </div>
                </div>
              ))}
              {messages.length < total && (
                <button
                  onClick={() => loadMessages(page + 1)}
                  disabled={loadingMore}
                  style={{
                    width: '100%', marginTop: 4, padding: '12px 0',
                    background: parchment, border: `1px solid ${parchment}`,
                    borderRadius: 8, fontSize: 12, fontWeight: 500,
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
            <div className="flex gap-4 flex-start"><span style={{ color: inkMid, fontWeight: 500 }}>주소</span>(06959) 서울특별시 동작구 성대로1길 26</div>
            <div className="flex gap-2 flex-start"><span style={{ color: inkMid, fontWeight: 500 }}>농인부</span>6층 교육관 · 주일 오전 11시</div>
            <div className="flex gap-2 flex-start">
                <div style={{ color: inkMid, fontWeight: 500 }}>사랑부</div>
                <div className="flex flex-col">
                  <div>제2교육관 갈릴리홀 · 주일 오후 12시</div>
                  <div className='leading-4'>사랑부는 매달 4번째 주 열린예배♥</div>
                </div>
            </div>
          </div>
        </footer>
      </div>

      {/* ── 하단 고정 FAB ── */}
      <button
        onClick={openModal}
        style={{
          position: 'fixed', bottom: 24, right: 20, zIndex: 100,
          background: gold, color: '#fff',
          border: 'none', borderRadius: 28,
          padding: '12px 20px',
          fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(184,154,90,0.45)',
          display: 'flex', alignItems: 'center', gap: 7,
          fontFamily: 'var(--font-noto-sans)',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
        onMouseLeave={e => (e.currentTarget.style.transform = '')}
      >
        <PiHandsPrayingFill size={16} />
        응원 메시지 쓰기
      </button>

      {/* ── 작성 모달 (바텀시트) ── */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(20,16,10,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '20px 24px 40px',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            }}
          >
            {/* 핸들 */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: parchment, margin: '0 auto 20px' }} />

            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: gold, fontWeight: 600, marginBottom: 18 }}>✦ 응원 메시지</div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: inkSoft, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>이름</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#faf9f6', border: `1px solid ${parchment}`,
                    borderRadius: 6, padding: '10px 13px',
                    fontSize: 14, color: ink, outline: 'none',
                    fontFamily: 'var(--font-noto-sans)',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: inkSoft, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>메시지</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
                  placeholder="응원의 말씀이나 기도를 남겨주세요"
                  rows={4}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#faf9f6', border: `1px solid ${parchment}`,
                    borderRadius: 6, padding: '10px 13px',
                    fontSize: 14, color: ink, outline: 'none',
                    resize: 'none', fontFamily: 'var(--font-noto-sans)', lineHeight: 1.7,
                  }}
                />
              </div>

              {/* 이미지 첨부 */}
              <div>
                <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                {imagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={imagePreview} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'cover', border: `1px solid ${parchment}` }} />
                    <button
                      type="button"
                      onClick={removeImage}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)', border: 'none',
                        color: '#fff', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: `1px dashed ${parchment}`,
                      borderRadius: 6, padding: '8px 14px',
                      fontSize: 12, color: inkSoft, cursor: 'pointer',
                      fontFamily: 'var(--font-noto-sans)',
                    }}
                  >
                    📎 사진 첨부 <span style={{ fontSize: 11, opacity: 0.6 }}>(5MB 이하 자동 압축)</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || uploadingImg || (!content.trim() && !imageFile)}
                style={{
                  width: '100%', padding: '13px 0',
                  background: gold, color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '0.06em',
                  opacity: ((!content.trim() && !imageFile) || submitting || uploadingImg) ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                  fontFamily: 'var(--font-noto-sans)',
                }}
              >
                {uploadingImg ? '이미지 처리 중…' : submitting ? '전송 중…' : '전송하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
