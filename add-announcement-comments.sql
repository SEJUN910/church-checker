-- 공지사항 댓글 테이블 추가
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL,
  church_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_type VARCHAR(20) NOT NULL, -- 'student' or 'teacher'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_comments_announcement ON public.announcement_comments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_comments_church ON public.announcement_comments(church_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON public.announcement_comments(created_at);

-- RLS 정책 (Row Level Security)
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

-- 모든 사람이 읽을 수 있음
CREATE POLICY "Anyone can view comments" ON public.announcement_comments
  FOR SELECT USING (true);

-- 로그인한 사용자만 댓글 작성 가능
CREATE POLICY "Authenticated users can create comments" ON public.announcement_comments
  FOR INSERT WITH CHECK (true);

-- 본인 댓글만 삭제 가능
CREATE POLICY "Users can delete own comments" ON public.announcement_comments
  FOR DELETE USING (created_by = auth.uid());
