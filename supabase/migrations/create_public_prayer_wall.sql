-- 공개 기도제목/응원 게시판 테이블
CREATE TABLE IF NOT EXISTS public_prayer_wall (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '익명',
  category TEXT NOT NULL DEFAULT '일반',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  encouragement_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public_prayer_wall ENABLE ROW LEVEL SECURITY;

-- 익명 사용자도 읽기 가능 (공개 페이지용)
CREATE POLICY "public read" ON public_prayer_wall
  FOR SELECT USING (true);

-- 응원 카운트 업데이트 허용 (anon)
CREATE POLICY "public encourage update" ON public_prayer_wall
  FOR UPDATE USING (true) WITH CHECK (true);

-- API 라우트에서 서비스 롤 키를 사용하는 경우 RLS를 우회하므로 아래 정책은 불필요.
-- SUPABASE_SERVICE_ROLE_KEY 환경변수가 없을 때를 위한 fallback 정책:
CREATE POLICY "admin insert via api" ON public_prayer_wall
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin delete via api" ON public_prayer_wall
  FOR DELETE USING (true);
