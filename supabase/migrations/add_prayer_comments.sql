-- 기도제목 댓글 테이블 생성
CREATE TABLE IF NOT EXISTS prayer_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prayer_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_prayer_comments_prayer_id ON prayer_comments(prayer_id);
CREATE INDEX IF NOT EXISTS idx_prayer_comments_created_at ON prayer_comments(created_at);

-- RLS 정책 활성화
ALTER TABLE prayer_comments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 댓글을 읽을 수 있음
CREATE POLICY "Anyone can read prayer comments"
  ON prayer_comments
  FOR SELECT
  USING (true);

-- 인증된 사용자만 댓글을 작성할 수 있음
CREATE POLICY "Authenticated users can create comments"
  ON prayer_comments
  FOR INSERT
  WITH CHECK (true);

-- 댓글 작성자만 삭제할 수 있음
CREATE POLICY "Users can delete own comments"
  ON prayer_comments
  FOR DELETE
  USING (true);
