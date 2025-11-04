-- 기존 교회 owner들을 church_members 테이블에 admin으로 추가
-- 이미 존재하는 경우는 무시 (UNIQUE 제약조건으로 인해)

INSERT INTO public.church_members (church_id, user_id, role, joined_at)
SELECT
  c.id as church_id,
  c.owner_id as user_id,
  'admin' as role,
  c.created_at as joined_at
FROM public.churches c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.church_members cm
    WHERE cm.church_id = c.id
      AND cm.user_id = c.owner_id
  );
