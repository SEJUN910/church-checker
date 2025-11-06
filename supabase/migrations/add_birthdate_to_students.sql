-- 학생 테이블에 생년월일 필드 추가
ALTER TABLE students
ADD COLUMN IF NOT EXISTS birthdate DATE;

-- 기존 나이 데이터를 기반으로 대략적인 생년월일 설정 (선택사항)
-- 이 작업은 수동으로 하거나 스킵할 수 있습니다
-- UPDATE students
-- SET birthdate = DATE_TRUNC('year', NOW()) - (age || ' years')::INTERVAL
-- WHERE age IS NOT NULL AND birthdate IS NULL;
