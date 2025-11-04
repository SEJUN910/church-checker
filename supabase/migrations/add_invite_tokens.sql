-- 초대 토큰 테이블
CREATE TABLE IF NOT EXISTS public.church_invite_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_invite_tokens_church ON public.church_invite_tokens(church_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON public.church_invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON public.church_invite_tokens(expires_at);
