-- ① members 테이블에 필요한 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS attendance_days TEXT[] DEFAULT ARRAY['0'];

-- ② attendance 테이블: FK 제약 제거 후 members 참조로 재연결
--    (student_id 컬럼명은 유지 — 코드 변경 최소화)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES members(id) ON DELETE CASCADE;

-- ③ offerings 테이블
ALTER TABLE offerings DROP CONSTRAINT IF EXISTS offerings_student_id_fkey;
ALTER TABLE offerings ADD CONSTRAINT offerings_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES members(id) ON DELETE SET NULL;

-- ④ prayer_requests 테이블
ALTER TABLE prayer_requests DROP CONSTRAINT IF EXISTS prayer_requests_student_id_fkey;
ALTER TABLE prayer_requests ADD CONSTRAINT prayer_requests_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES members(id) ON DELETE SET NULL;

-- ⑤ service_schedules 테이블
ALTER TABLE service_schedules DROP CONSTRAINT IF EXISTS service_schedules_assigned_student_id_fkey;
ALTER TABLE service_schedules ADD CONSTRAINT service_schedules_assigned_student_id_fkey
  FOREIGN KEY (assigned_student_id) REFERENCES members(id) ON DELETE SET NULL;

-- ⑥ students 테이블 삭제 (CASCADE로 남은 FK 정리)
DROP TABLE IF EXISTS students CASCADE;
