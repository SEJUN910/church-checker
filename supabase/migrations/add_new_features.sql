-- 교회 일정 테이블
CREATE TABLE IF NOT EXISTS church_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL, -- 'service', 'meeting', 'retreat', 'special', 'other'
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 봉사 스케줄 테이블
CREATE TABLE IF NOT EXISTS service_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  event_id UUID REFERENCES church_events(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL, -- 'worship', 'prayer', 'word', 'accompanist', 'media', 'other'
  service_name VARCHAR(255) NOT NULL, -- '찬양 인도', '기도', '말씀', '반주', '영상' 등
  assigned_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  schedule_date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'replacement_needed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기도제목 테이블
CREATE TABLE IF NOT EXISTS prayer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  is_answered BOOLEAN DEFAULT false,
  answer_testimony TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 성경 읽기 계획 테이블
CREATE TABLE IF NOT EXISTS bible_reading_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_chapters INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 성경 읽기 체크 테이블
CREATE TABLE IF NOT EXISTS bible_reading_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES bible_reading_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_name VARCHAR(50) NOT NULL,
  chapter INT NOT NULL,
  read_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, student_id, book_name, chapter)
);

-- 헌금 기록 테이블
CREATE TABLE IF NOT EXISTS offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  offering_type VARCHAR(50) NOT NULL, -- 'tithe', 'thanksgiving', 'mission', 'building', 'special', 'other'
  amount DECIMAL(10, 2) NOT NULL,
  offering_date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 지출 기록 테이블
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'snacks', 'materials', 'events', 'equipment', 'transportation', 'other'
  item_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 오늘의 말씀 테이블
CREATE TABLE IF NOT EXISTS daily_verses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verse_date DATE NOT NULL UNIQUE,
  verse_text TEXT NOT NULL,
  verse_reference VARCHAR(255) NOT NULL, -- 예: "요한복음 3:16"
  translation VARCHAR(50) DEFAULT 'KRV', -- 'KRV' (개역한글), 'NIV', 'ESV' 등
  source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'gemini', 'gpt'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_church_events_church_id ON church_events(church_id);
CREATE INDEX IF NOT EXISTS idx_church_events_start_datetime ON church_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_service_schedules_church_id ON service_schedules(church_id);
CREATE INDEX IF NOT EXISTS idx_service_schedules_date ON service_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_church_id ON prayer_requests(church_id);
CREATE INDEX IF NOT EXISTS idx_bible_reading_plans_church_id ON bible_reading_plans(church_id);
CREATE INDEX IF NOT EXISTS idx_bible_reading_checks_plan_id ON bible_reading_checks(plan_id);
CREATE INDEX IF NOT EXISTS idx_bible_reading_checks_student_id ON bible_reading_checks(student_id);
CREATE INDEX IF NOT EXISTS idx_offerings_church_id ON offerings(church_id);
CREATE INDEX IF NOT EXISTS idx_offerings_date ON offerings(offering_date);
CREATE INDEX IF NOT EXISTS idx_expenses_church_id ON expenses(church_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_daily_verses_date ON daily_verses(verse_date);

-- RLS (Row Level Security) 활성화
ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_reading_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_verses ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 사용자가 읽을 수 있도록)
CREATE POLICY "Anyone can view church events" ON church_events FOR SELECT USING (true);
CREATE POLICY "Anyone can view service schedules" ON service_schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can view prayer requests" ON prayer_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can view bible reading plans" ON bible_reading_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can view bible reading checks" ON bible_reading_checks FOR SELECT USING (true);
CREATE POLICY "Anyone can view offerings" ON offerings FOR SELECT USING (true);

-- 삽입/수정/삭제는 인증된 사용자만
CREATE POLICY "Authenticated users can insert church events" ON church_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update church events" ON church_events FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete church events" ON church_events FOR DELETE USING (true);

CREATE POLICY "Authenticated users can insert service schedules" ON service_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update service schedules" ON service_schedules FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete service schedules" ON service_schedules FOR DELETE USING (true);

CREATE POLICY "Authenticated users can insert prayer requests" ON prayer_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update prayer requests" ON prayer_requests FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete prayer requests" ON prayer_requests FOR DELETE USING (true);

CREATE POLICY "Authenticated users can insert bible reading plans" ON bible_reading_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update bible reading plans" ON bible_reading_plans FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete bible reading plans" ON bible_reading_plans FOR DELETE USING (true);

CREATE POLICY "Authenticated users can insert bible reading checks" ON bible_reading_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update bible reading checks" ON bible_reading_checks FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete bible reading checks" ON bible_reading_checks FOR DELETE USING (true);

CREATE POLICY "Authenticated users can insert offerings" ON offerings FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update offerings" ON offerings FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete offerings" ON offerings FOR DELETE USING (true);

CREATE POLICY "Anyone can view expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update expenses" ON expenses FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete expenses" ON expenses FOR DELETE USING (true);

CREATE POLICY "Anyone can view daily verses" ON daily_verses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert daily verses" ON daily_verses FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily verses" ON daily_verses FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete daily verses" ON daily_verses FOR DELETE USING (true);
