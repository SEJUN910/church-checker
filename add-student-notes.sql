-- students 테이블에 메모 필드 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS notes TEXT;