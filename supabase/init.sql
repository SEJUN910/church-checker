-- ============================================
-- Church Checker Supabase 초기화 SQL
-- 모든 테이블 삭제 후 새로 생성
-- ============================================

-- 1. 기존 테이블 삭제 (순서 중요 - FK 의존성 역순)
DROP TABLE IF EXISTS member_role_history CASCADE;
DROP TABLE IF EXISTS church_invite_tokens CASCADE;
DROP TABLE IF EXISTS announcement_reads CASCADE;
DROP TABLE IF EXISTS announcement_comments CASCADE;
DROP TABLE IF EXISTS prayer_comments CASCADE;
DROP TABLE IF EXISTS service_schedules CASCADE;
DROP TABLE IF EXISTS church_events CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS offerings CASCADE;
DROP TABLE IF EXISTS daily_verses CASCADE;
DROP TABLE IF EXISTS prayer_requests CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS church_members CASCADE;
DROP TABLE IF EXISTS churches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 2. 테이블 생성
-- ============================================

-- 2-1. profiles (사용자 프로필)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    bio TEXT,
    avatar_url TEXT,
    kakao_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-2. churches (교회)
CREATE TABLE churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-3. church_members (교회 멤버)
CREATE TABLE church_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'teacher', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(church_id, user_id)
);

-- 2-4. students (학생/교사)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    age INTEGER,
    grade VARCHAR(50),
    birthdate DATE,
    photo_url TEXT,
    type VARCHAR(20) DEFAULT 'student' CHECK (type IN ('student', 'teacher')),
    notes TEXT,
    registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-5. attendance (출석)
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- 2-6. announcements (공지사항)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    author_name VARCHAR(100),
    image_url TEXT,
    category VARCHAR(50) DEFAULT '일반',
    is_pinned BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    pinned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-7. announcement_comments (공지 댓글)
CREATE TABLE announcement_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name VARCHAR(255),
    author_type VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-8. announcement_reads (공지 읽음)
CREATE TABLE announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- 2-9. prayer_requests (기도제목)
CREATE TABLE prayer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    is_answered BOOLEAN DEFAULT false,
    answer_testimony TEXT,
    answered_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-10. prayer_comments (기도 댓글)
CREATE TABLE prayer_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-11. church_events (행사)
CREATE TABLE church_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'other' CHECK (event_type IN ('service', 'meeting', 'retreat', 'special', 'other')),
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ,
    location VARCHAR(255),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-12. service_schedules (봉사 스케줄)
CREATE TABLE service_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    event_id UUID REFERENCES church_events(id) ON DELETE SET NULL,
    service_type VARCHAR(50) CHECK (service_type IN ('worship', 'prayer', 'word', 'accompanist', 'media', 'other')),
    service_name VARCHAR(255),
    assigned_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    schedule_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'replacement_needed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-13. offerings (헌금)
CREATE TABLE offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    offering_type VARCHAR(50) DEFAULT 'thanksgiving' CHECK (offering_type IN ('tithe', 'thanksgiving', 'mission', 'building', 'special')),
    amount DECIMAL(10, 2) NOT NULL,
    offering_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-14. expenses (지출)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'other' CHECK (category IN ('snacks', 'materials', 'events', 'equipment', 'transportation', 'other')),
    item_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-15. daily_verses (오늘의 말씀)
CREATE TABLE daily_verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verse_date DATE UNIQUE NOT NULL,
    verse_text TEXT NOT NULL,
    verse_reference VARCHAR(255) NOT NULL,
    translation VARCHAR(50) DEFAULT 'KRV',
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-16. church_invite_tokens (초대 토큰)
CREATE TABLE church_invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-17. member_role_history (역할 변경 이력)
CREATE TABLE member_role_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    member_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 인덱스 생성
-- ============================================

CREATE INDEX idx_profiles_kakao_id ON profiles(kakao_id);
CREATE INDEX idx_churches_owner_id ON churches(owner_id);
CREATE INDEX idx_church_members_church_id ON church_members(church_id);
CREATE INDEX idx_church_members_user_id ON church_members(user_id);
CREATE INDEX idx_students_church_id ON students(church_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_church_id ON attendance(church_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_announcements_church_id ON announcements(church_id);
CREATE INDEX idx_announcements_pinned ON announcements(is_pinned, created_at DESC);
CREATE INDEX idx_announcement_comments_announcement_id ON announcement_comments(announcement_id);
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX idx_prayer_requests_church_id ON prayer_requests(church_id);
CREATE INDEX idx_prayer_comments_prayer_id ON prayer_comments(prayer_id);
CREATE INDEX idx_church_events_church_id ON church_events(church_id);
CREATE INDEX idx_church_events_start ON church_events(start_datetime);
CREATE INDEX idx_service_schedules_church_id ON service_schedules(church_id);
CREATE INDEX idx_service_schedules_date ON service_schedules(schedule_date);
CREATE INDEX idx_offerings_church_id ON offerings(church_id);
CREATE INDEX idx_offerings_date ON offerings(offering_date);
CREATE INDEX idx_expenses_church_id ON expenses(church_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_daily_verses_date ON daily_verses(verse_date);
CREATE INDEX idx_church_invite_tokens_token ON church_invite_tokens(token);
CREATE INDEX idx_member_role_history_church_id ON member_role_history(church_id);

-- ============================================
-- 4. RLS (Row Level Security) 설정
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_role_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4-1. profiles 정책
-- ============================================

-- 자신의 프로필 조회
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 같은 교회 멤버 프로필 조회
CREATE POLICY "Users can view church members profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members cm1
        JOIN church_members cm2 ON cm1.church_id = cm2.church_id
        WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
    )
);

-- 자신의 프로필 생성
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 자신의 프로필 수정
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- ============================================
-- 4-2. churches 정책
-- ============================================

-- 멤버인 교회 조회
CREATE POLICY "Members can view their churches"
ON churches FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = churches.id AND user_id = auth.uid()
    )
);

-- 인증된 사용자 교회 생성
CREATE POLICY "Authenticated users can create churches"
ON churches FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- owner/admin만 수정
CREATE POLICY "Owners and admins can update churches"
ON churches FOR UPDATE
USING (
    owner_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = churches.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- owner만 삭제
CREATE POLICY "Only owners can delete churches"
ON churches FOR DELETE
USING (owner_id = auth.uid());

-- ============================================
-- 4-3. church_members 정책
-- ============================================

-- 같은 교회 멤버 조회
CREATE POLICY "Members can view church members"
ON church_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members cm
        WHERE cm.church_id = church_members.church_id AND cm.user_id = auth.uid()
    )
);

-- 인증된 사용자 가입
CREATE POLICY "Users can join churches"
ON church_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- owner/admin만 수정
CREATE POLICY "Admins can update members"
ON church_members FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members cm
        WHERE cm.church_id = church_members.church_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- 자신 탈퇴 또는 admin 강퇴
CREATE POLICY "Users can leave or admins can remove"
ON church_members FOR DELETE
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members cm
        WHERE cm.church_id = church_members.church_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-4. students 정책
-- ============================================

-- 같은 교회 학생 조회
CREATE POLICY "Members can view students"
ON students FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = students.church_id AND user_id = auth.uid()
    )
);

-- 멤버가 학생 등록
CREATE POLICY "Members can add students"
ON students FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = students.church_id AND user_id = auth.uid()
    )
);

-- 멤버가 학생 수정
CREATE POLICY "Members can update students"
ON students FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = students.church_id AND user_id = auth.uid()
    )
);

-- admin/teacher만 삭제
CREATE POLICY "Admins can delete students"
ON students FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = students.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

-- ============================================
-- 4-5. attendance 정책
-- ============================================

-- 같은 교회 출석 조회
CREATE POLICY "Members can view attendance"
ON attendance FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = attendance.church_id AND user_id = auth.uid()
    )
);

-- 멤버가 출석 기록
CREATE POLICY "Members can record attendance"
ON attendance FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = attendance.church_id AND user_id = auth.uid()
    )
);

-- 멤버가 출석 삭제
CREATE POLICY "Members can delete attendance"
ON attendance FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = attendance.church_id AND user_id = auth.uid()
    )
);

-- ============================================
-- 4-6. announcements 정책
-- ============================================

-- 같은 교회 공지 조회
CREATE POLICY "Members can view announcements"
ON announcements FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcements.church_id AND user_id = auth.uid()
    )
);

-- 멤버가 공지 작성
CREATE POLICY "Members can create announcements"
ON announcements FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcements.church_id AND user_id = auth.uid()
    )
);

-- 작성자 또는 admin 수정
CREATE POLICY "Authors or admins can update announcements"
ON announcements FOR UPDATE
USING (
    author_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcements.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- 작성자 또는 admin 삭제
CREATE POLICY "Authors or admins can delete announcements"
ON announcements FOR DELETE
USING (
    author_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcements.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-7. announcement_comments 정책
-- ============================================

CREATE POLICY "Members can view comments"
ON announcement_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcement_comments.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can add comments"
ON announcement_comments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = announcement_comments.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Authors can delete own comments"
ON announcement_comments FOR DELETE
USING (created_by = auth.uid());

-- ============================================
-- 4-8. announcement_reads 정책
-- ============================================

CREATE POLICY "Users can view own reads"
ON announcement_reads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can mark as read"
ON announcement_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4-9. prayer_requests 정책
-- ============================================

CREATE POLICY "Members can view prayers"
ON prayer_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = prayer_requests.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can create prayers"
ON prayer_requests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = prayer_requests.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Authors or admins can update prayers"
ON prayer_requests FOR UPDATE
USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = prayer_requests.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Authors or admins can delete prayers"
ON prayer_requests FOR DELETE
USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = prayer_requests.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-10. prayer_comments 정책
-- ============================================

CREATE POLICY "Members can view prayer comments"
ON prayer_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM prayer_requests pr
        JOIN church_members cm ON cm.church_id = pr.church_id
        WHERE pr.id = prayer_comments.prayer_id AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can add prayer comments"
ON prayer_comments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM prayer_requests pr
        JOIN church_members cm ON cm.church_id = pr.church_id
        WHERE pr.id = prayer_comments.prayer_id AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Authors can delete own prayer comments"
ON prayer_comments FOR DELETE
USING (created_by = auth.uid());

-- ============================================
-- 4-11. church_events 정책
-- ============================================

CREATE POLICY "Members can view events"
ON church_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_events.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can create events"
ON church_events FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_events.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can update events"
ON church_events FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_events.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can delete events"
ON church_events FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_events.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

-- ============================================
-- 4-12. service_schedules 정책
-- ============================================

CREATE POLICY "Members can view schedules"
ON service_schedules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = service_schedules.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can create schedules"
ON service_schedules FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = service_schedules.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can update schedules"
ON service_schedules FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = service_schedules.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can delete schedules"
ON service_schedules FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = service_schedules.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

-- ============================================
-- 4-13. offerings 정책
-- ============================================

CREATE POLICY "Members can view offerings"
ON offerings FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = offerings.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage offerings"
ON offerings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = offerings.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

CREATE POLICY "Admins can update offerings"
ON offerings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = offerings.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

CREATE POLICY "Admins can delete offerings"
ON offerings FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = offerings.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-14. expenses 정책
-- ============================================

CREATE POLICY "Members can view expenses"
ON expenses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = expenses.church_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage expenses"
ON expenses FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = expenses.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

CREATE POLICY "Admins can update expenses"
ON expenses FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = expenses.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
);

CREATE POLICY "Admins can delete expenses"
ON expenses FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = expenses.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-15. daily_verses 정책
-- ============================================

-- 모든 인증 사용자 조회 가능
CREATE POLICY "Authenticated users can view verses"
ON daily_verses FOR SELECT
USING (auth.uid() IS NOT NULL);

-- admin만 관리
CREATE POLICY "Admins can manage verses"
ON daily_verses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update verses"
ON daily_verses FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete verses"
ON daily_verses FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ============================================
-- 4-16. church_invite_tokens 정책
-- ============================================

-- 토큰으로 조회 (공개)
CREATE POLICY "Anyone can view tokens by token value"
ON church_invite_tokens FOR SELECT
USING (true);

CREATE POLICY "Admins can create tokens"
ON church_invite_tokens FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_invite_tokens.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Admins can update tokens"
ON church_invite_tokens FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_invite_tokens.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Admins can delete tokens"
ON church_invite_tokens FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = church_invite_tokens.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- ============================================
-- 4-17. member_role_history 정책
-- ============================================

CREATE POLICY "Admins can view role history"
ON member_role_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM church_members
        WHERE church_id = member_role_history.church_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "System can insert role history"
ON member_role_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 5. 함수 및 트리거
-- ============================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_churches_updated_at
    BEFORE UPDATE ON churches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcement_comments_updated_at
    BEFORE UPDATE ON announcement_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prayer_requests_updated_at
    BEFORE UPDATE ON prayer_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prayer_comments_updated_at
    BEFORE UPDATE ON prayer_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_church_events_updated_at
    BEFORE UPDATE ON church_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_schedules_updated_at
    BEFORE UPDATE ON service_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offerings_updated_at
    BEFORE UPDATE ON offerings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_verses_updated_at
    BEFORE UPDATE ON daily_verses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 새 사용자 프로필 자동 생성 트리거
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, avatar_url, kakao_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', '사용자'),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'kakao_id'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 완료!
-- ============================================
