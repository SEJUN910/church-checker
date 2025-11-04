-- 기도 요청 테이블에 새 컬럼 추가
ALTER TABLE prayer_requests
ADD COLUMN IF NOT EXISTS is_answered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '일반',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '진행중',
ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE;

-- 카테고리 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_prayer_requests_category ON prayer_requests(category);

-- 상태 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_prayer_requests_status ON prayer_requests(status);

-- 응답 여부 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_prayer_requests_is_answered ON prayer_requests(is_answered);
