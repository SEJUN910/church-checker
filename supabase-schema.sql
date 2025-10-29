-- 교회 출석 체크 앱 데이터베이스 스키마 (간소화 버전)
-- Supabase SQL Editor에서 실행하세요

-- 1. Users 테이블 (Supabase Auth를 사용하므로 확장 정보만)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  kakao_id VARCHAR(255) UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  profile_image TEXT,
  role VARCHAR(20) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Churches 테이블
CREATE TABLE IF NOT EXISTS public.churches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Church Members 테이블 (교회와 유저의 관계)
CREATE TABLE IF NOT EXISTS public.church_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID,
  user_id UUID,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, user_id)
);

-- 4. Students 테이블
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  age INTEGER,
  grade VARCHAR(50),
  photo_url TEXT,
  type VARCHAR(20) DEFAULT 'student', -- 'student' 또는 'teacher'
  registered_by UUID,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Attendance 테이블
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID,
  church_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_churches_owner ON public.churches(owner_id);
CREATE INDEX IF NOT EXISTS idx_church_members_church ON public.church_members(church_id);
CREATE INDEX IF NOT EXISTS idx_church_members_user ON public.church_members(user_id);
CREATE INDEX IF NOT EXISTS idx_students_church ON public.students(church_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_church ON public.attendance(church_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
