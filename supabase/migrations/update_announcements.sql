-- 공지사항 테이블에 새 컬럼 추가
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '일반',
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;

-- 고정 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned);

-- 카테고리 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category);
