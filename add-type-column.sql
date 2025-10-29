-- 기존 students 테이블에 type 컬럼 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'student';

-- type 컬럼에 체크 제약 추가 (student 또는 teacher만 허용)
ALTER TABLE public.students
ADD CONSTRAINT students_type_check
CHECK (type IN ('student', 'teacher'));

-- 기존 데이터는 모두 'student'로 설정
UPDATE public.students SET type = 'student' WHERE type IS NULL;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_students_type ON public.students(type);
CREATE INDEX IF NOT EXISTS idx_students_church_type ON public.students(church_id, type);
