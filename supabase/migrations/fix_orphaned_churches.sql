-- 1. 먼저 문제가 있는 교회들을 확인
-- (owner_id가 auth.users에 없는 경우)
SELECT c.id, c.name, c.owner_id
FROM public.churches c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = c.owner_id
  );

-- 2. 옵션 1: 문제가 있는 교회의 owner_id를 NULL로 설정
-- (주의: 이렇게 하면 해당 교회에 owner가 없어집니다)
-- UPDATE public.churches
-- SET owner_id = NULL
-- WHERE owner_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM auth.users u WHERE u.id = owner_id
--   );

-- 3. 옵션 2: 문제가 있는 교회를 삭제
-- (주의: 교회와 관련된 모든 데이터가 삭제됩니다)
-- DELETE FROM public.churches
-- WHERE owner_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM auth.users u WHERE u.id = owner_id
--   );

-- 4. 유효한 owner만 church_members에 추가
INSERT INTO public.church_members (church_id, user_id, role, joined_at)
SELECT
  c.id as church_id,
  c.owner_id as user_id,
  'admin' as role,
  c.created_at as joined_at
FROM public.churches c
WHERE c.owner_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = c.owner_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.church_members cm
    WHERE cm.church_id = c.id
      AND cm.user_id = c.owner_id
  );
