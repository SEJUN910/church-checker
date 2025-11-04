-- 학생 테이블에 출석 요일 컬럼 추가
ALTER TABLE students
ADD COLUMN IF NOT EXISTS attendance_days TEXT[] DEFAULT ARRAY['0','1','2','3','4','5','6'];

-- 출석 요일 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_students_attendance_days ON students USING GIN (attendance_days);

-- 기존 데이터에 기본값 설정 (모든 요일)
UPDATE students
SET attendance_days = ARRAY['0','1','2','3','4','5','6']
WHERE attendance_days IS NULL;
