-- 기도제목 응원메세지(댓글) 테이블
CREATE TABLE IF NOT EXISTS public_prayer_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id UUID NOT NULL REFERENCES public_prayer_wall(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '익명',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_prayer_comments ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "public read comments" ON public_prayer_comments
  FOR SELECT USING (true);

-- 누구나 댓글 작성 가능
CREATE POLICY "public insert comments" ON public_prayer_comments
  FOR INSERT WITH CHECK (true);

-- 삭제는 API 라우트에서 처리
CREATE POLICY "admin delete comments" ON public_prayer_comments
  FOR DELETE USING (true);
