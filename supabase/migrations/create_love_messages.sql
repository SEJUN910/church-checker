-- 공개 응원메세지 테이블 (기도제목과 별개의 일반 게시판)
CREATE TABLE IF NOT EXISTS public_love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL DEFAULT '익명',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_love_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read messages" ON public_love_messages
  FOR SELECT USING (true);

CREATE POLICY "public insert messages" ON public_love_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin delete messages" ON public_love_messages
  FOR DELETE USING (true);
