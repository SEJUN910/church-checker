-- Church Members 테이블 외래 키 추가 (기존 테이블 수정)
-- 테이블은 이미 존재한다고 가정하고 외래 키만 추가합니다

-- 1. 외래 키 제약조건 추가 (이미 있으면 스킵)
DO $$
BEGIN
  -- church_id 외래 키
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'church_members_church_id_fkey'
  ) THEN
    ALTER TABLE public.church_members
      ADD CONSTRAINT church_members_church_id_fkey
      FOREIGN KEY (church_id)
      REFERENCES public.churches(id)
      ON DELETE CASCADE;
  END IF;

  -- user_id 외래 키 (auth.users 테이블 참조)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'church_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.church_members
      ADD CONSTRAINT church_members_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2. 인덱스 생성 (이미 있으면 스킵)
CREATE INDEX IF NOT EXISTS idx_church_members_church ON public.church_members(church_id);
CREATE INDEX IF NOT EXISTS idx_church_members_user ON public.church_members(user_id);
CREATE INDEX IF NOT EXISTS idx_church_members_role ON public.church_members(role);
