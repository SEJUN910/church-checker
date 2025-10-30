-- 공지사항 테이블 추가
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 관리자 테이블 (기존 church_members 활용 - role을 'admin'으로 설정)
-- church_members 테이블의 role 컬럼 활용:
-- - 'owner': 교회 생성자
-- - 'admin': 관리자 (출석 체크, 공지사항 작성 가능)
-- - 'member': 일반 멤버

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_announcements_church ON public.announcements(church_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at);

-- 교회 멤버 초대를 위한 invite 테이블
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID,
  invited_by UUID,
  invite_code VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'admin', -- 초대받은 사람의 역할
  expires_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invites_church ON public.invites(church_id);
