-- 공지사항 이미지 첨부 기능을 위한 컬럼 추가
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 공지사항 고정 시간 컬럼 추가
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;

-- 공지사항 읽음 표시를 위한 테이블 생성
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

-- 멤버 역할 변경 이력을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS member_role_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 활성화
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_role_history ENABLE ROW LEVEL SECURITY;

-- announcement_reads 정책
CREATE POLICY "Users can view their own read status"
  ON announcement_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read status"
  ON announcement_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- member_role_history 정책 (관리자만 조회 가능)
CREATE POLICY "Admins can view role history"
  ON member_role_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM church_members
      WHERE church_id = member_role_history.church_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM churches
      WHERE id = member_role_history.church_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert role history"
  ON member_role_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM church_members
      WHERE church_id = member_role_history.church_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM churches
      WHERE id = member_role_history.church_id
      AND owner_id = auth.uid()
    )
  );

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_member_role_history_church_id ON member_role_history(church_id);
CREATE INDEX IF NOT EXISTS idx_member_role_history_member_id ON member_role_history(member_id);
