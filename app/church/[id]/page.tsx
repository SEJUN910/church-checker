'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { uploadStudentPhoto } from '@/lib/supabase/storage';
import ImageUpload from './components/ImageUpload';
import AttendanceCalendar from './components/AttendanceCalendar';
import Announcements from './components/Announcements';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import toast, { Toaster } from 'react-hot-toast';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface Student {
  id: string;
  church_id: string;
  name: string;
  phone: string | null;
  age: number | null;
  grade: string | null;
  photo_url: string | null;
  type: 'student' | 'teacher';
  registered_at: string;
  notes: string | null;
  attendance_days?: string[];
}

interface Church {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  church_id: string;
  date: string;
  created_at: string;
}

interface AttendanceData {
  date: string;
  count: number;
}

interface PrayerRequest {
  id: string;
  church_id: string;
  student_id: string | null;
  title: string;
  content: string;
  is_anonymous: boolean;
  is_answered: boolean;
  answer_testimony: string | null;
  answered_at: string | null;
  created_by: string;
  created_at: string;
  student?: {
    name: string;
  };
}

export default function ChurchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [church, setChurch] = useState<Church | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'calendar' | 'announcements' | 'prayer' | '기도'>('attendance');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [weeklyAttendance, setWeeklyAttendance] = useState<AttendanceData[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceData[]>([]);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [showManagementMenu, setShowManagementMenu] = useState(false);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [newPrayer, setNewPrayer] = useState({
    title: '',
    content: '',
    is_anonymous: false,
    student_id: '',
    category: '일반',
    status: '진행중'
  });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: '일반',
    is_pinned: false
  });
  const [announcementKey, setAnnouncementKey] = useState(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceModalType, setAttendanceModalType] = useState<'student' | 'teacher'>('student');

  const supabase = createClient();

  // 새 학생 등록 폼
  const [newStudent, setNewStudent] = useState({
    name: '',
    phone: '',
    age: '',
    grade: '',
    type: 'student' as 'student' | 'teacher',
    attendance_days: ['0', '1', '2', '3', '4', '5', '6'] // 기본값: 모든 요일
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadData();
    checkUser();
    loadAttendanceData();
    loadPrayers();
  }, [churchId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
    if (!user) {
      router.push('/login');
      return;
    }

    const currentUserId = user.id;
    setUserId(currentUserId);

    // 관리자 권한 확인 (교회 owner 또는 admin 역할)
    const { data: churchData } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    if (churchData?.owner_id === currentUserId) {
      setIsAdmin(true);
    } else {
      // church_members에서 역할 확인
      const { data: memberData } = await supabase
        .from('church_members')
        .select('role')
        .eq('church_id', churchId)
        .eq('user_id', currentUserId)
        .single();

      setIsAdmin(memberData?.role === 'admin' || memberData?.role === 'owner');
    }
  };

  // 팝다운 메뉴 밖 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showManagementMenu) {
        const target = event.target as HTMLElement;
        // 메뉴 버튼이나 메뉴 내부가 아니면 닫기
        if (!target.closest('.management-menu-container')) {
          setShowManagementMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManagementMenu]);

  const loadPrayers = async () => {
    try {
      const { data: prayerData, error } = await supabase
        .from('prayer_requests')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // 학생 정보를 기도제목에 매핑
      const prayersWithStudents = await Promise.all(
        (prayerData || []).map(async (prayer) => {
          if (prayer.student_id && !prayer.is_anonymous) {
            const { data: student } = await supabase
              .from('students')
              .select('name')
              .eq('id', prayer.student_id)
              .single();

            return { ...prayer, student };
          }
          return prayer;
        })
      );

      setPrayers(prayersWithStudents);
    } catch (error) {
      console.error('기도제목 로드 실패:', error);
    }
  };

  const handleCreatePrayer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .insert([{
          ...newPrayer,
          church_id: churchId,
          created_by: userId,
          student_id: newPrayer.student_id || null
        }])
        .select()
        .single();

      if (error) throw error;

      // 학생 정보 추가
      if (data.student_id && !data.is_anonymous) {
        const student = students.find(s => s.id === data.student_id);
        data.student = student ? { name: student.name } : undefined;
      }

      setPrayers([data, ...prayers]);
      setShowPrayerModal(false);
      setNewPrayer({
        title: '',
        content: '',
        is_anonymous: false,
        student_id: '',
        category: '일반',
        status: '진행중'
      });
      toast.success('기도제목이 등록되었습니다 🙏');
    } catch (error) {
      console.error('기도제목 생성 실패:', error);
      toast.error('기도제목을 등록하는데 실패했습니다.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .insert([{
          church_id: churchId,
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          created_by: userId
        }]);

      if (error) throw error;

      setShowAnnouncementModal(false);
      setNewAnnouncement({
        title: '',
        content: '',
        category: '일반',
        is_pinned: false
      });
      setAnnouncementKey(prev => prev + 1); // 공지사항 컴포넌트 새로고침
      toast.success('공지사항이 등록되었습니다 📢');
    } catch (error) {
      console.error('공지사항 생성 실패:', error);
      toast.error('공지사항을 등록하는데 실패했습니다.');
    }
  };

  // 개인별 출석 통계 계산
  const getStudentAttendanceStats = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const studentRecords = attendanceRecords.filter(r => r.student_id === studentId);
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 이번 달 출석 수
    const thisMonthAttendance = studentRecords.filter(r => {
      const recordDate = new Date(r.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    }).length;

    // 총 출석 수
    const totalAttendance = studentRecords.length;

    // 학생의 출석 요일 설정 가져오기
    const attendanceDays = student?.attendance_days || ['0', '1', '2', '3', '4', '5', '6'];

    // 이번 달에서 해당 학생이 출석해야 하는 날 수 계산
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    let expectedDays = 0;
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date > today) break; // 오늘 이후는 제외
      const dayOfWeek = date.getDay().toString();
      if (attendanceDays.includes(dayOfWeek)) {
        expectedDays++;
      }
    }

    // 출석률 계산 (출석해야 하는 날 대비 실제 출석일)
    const attendanceRate = expectedDays > 0 ? Math.round((thisMonthAttendance / expectedDays) * 100) : 0;

    return {
      thisMonthAttendance,
      totalAttendance,
      attendanceRate,
      expectedDays
    };
  };

  const loadAttendanceData = async () => {
    try {
      const today = new Date();

      // 주간 데이터 (최근 7일)
      const weeklyData: AttendanceData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('attendance')
          .select('student_id')
          .eq('church_id', churchId)
          .eq('date', dateStr);

        if (error) throw error;

        // 중복 제거
        const uniqueStudents = new Set(data?.map(a => a.student_id) || []);
        weeklyData.push({
          date: dateStr,
          count: uniqueStudents.size
        });
      }
      setWeeklyAttendance(weeklyData);

      // 월간 데이터 (이번 주 포함 4주) - 주간 총 출석 수
      const monthlyData: AttendanceData[] = [];

      // 이번 주의 시작일 (일요일) 계산
      const currentDayOfWeek = today.getDay(); // 0 = 일요일
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - currentDayOfWeek);

      // 이번 주 포함 4주 (지난 3주 + 이번 주)
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(thisWeekStart);
        weekStart.setDate(thisWeekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const { data, error } = await supabase
          .from('attendance')
          .select('id')
          .eq('church_id', churchId)
          .gte('date', weekStart.toISOString().split('T')[0])
          .lte('date', weekEnd.toISOString().split('T')[0]);

        if (error) throw error;

        // 총 출석 수 (중복 포함)
        const totalCount = data?.length || 0;
        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        monthlyData.push({
          date: weekLabel,
          count: totalCount
        });
      }
      setMonthlyAttendance(monthlyData);
    } catch (error) {
      console.error('출석 데이터 로드 실패:', error);
    }
  };

  const loadData = async () => {
    try {
      // 교회 정보 로드
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', churchId)
        .single();

      if (churchError) throw churchError;
      if (!churchData) {
        router.push('/');
        return;
      }
      setChurch(churchData);

      // 학생 목록 로드
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('church_id', churchId)
        .order('registered_at', { ascending: false });

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // 출석 기록 로드
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (attendanceError) throw attendanceError;
      setAttendanceRecords(attendanceData || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 출석 요일 토글
  const toggleAttendanceDay = (day: string) => {
    const currentDays = newStudent.attendance_days || [];
    if (currentDays.includes(day)) {
      setNewStudent({
        ...newStudent,
        attendance_days: currentDays.filter(d => d !== day)
      });
    } else {
      setNewStudent({
        ...newStudent,
        attendance_days: [...currentDays, day].sort()
      });
    }
  };

  // 새 학생/교사 추가
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !userId) return;

    try {
      // 먼저 학생 정보 저장
      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            church_id: churchId,
            name: newStudent.name,
            phone: newStudent.phone || null,
            age: newStudent.age ? parseInt(newStudent.age) : null,
            grade: newStudent.grade || null,
            type: newStudent.type,
            registered_by: userId,
            attendance_days: newStudent.attendance_days
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // 사진이 선택되었으면 업로드
      let photoUrl = null;
      if (selectedPhoto && data.id) {
        photoUrl = await uploadStudentPhoto(selectedPhoto, data.id, churchId);

        // photo_url 업데이트
        if (photoUrl) {
          await supabase
            .from('students')
            .update({ photo_url: photoUrl })
            .eq('id', data.id);

          data.photo_url = photoUrl;
        }
      }

      setStudents([data, ...students]);
      setNewStudent({ name: '', phone: '', age: '', grade: '', type: 'student', attendance_days: ['0', '1', '2', '3', '4', '5', '6'] });
      setSelectedPhoto(null);
      setShowAddStudentModal(false);
    } catch (error) {
      console.error('등록 실패:', error);
      alert('등록하는데 실패했습니다.');
    }
  };

  // 학생 편집 모달 열기
  const handleEditStudent = (student: Student) => {
    setEditingStudent({...student});
    setShowEditStudentModal(true);
  };

  // 학생 정보 수정
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editingStudent.name,
          phone: editingStudent.phone || null,
          age: editingStudent.age || null,
          grade: editingStudent.grade || null,
          type: editingStudent.type,
          notes: editingStudent.notes || null
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      setStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
      setShowEditStudentModal(false);
      setEditingStudent(null);
    } catch (error) {
      console.error('학생 정보 수정 실패:', error);
      alert('학생 정보를 수정하는데 실패했습니다.');
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;

      setStudents(students.filter(s => s.id !== studentId));
      setAttendanceRecords(attendanceRecords.filter(a => a.student_id !== studentId));
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      alert('학생을 삭제하는데 실패했습니다.');
    }
  };

  // 출석 체크
  const handleCheckAttendance = async (student: Student) => {
    const today = new Date().toISOString().split('T')[0];

    // userId 또는 churchId가 없으면 에러
    if (!userId) {
      toast.error('사용자 정보를 확인할 수 없습니다.');
      return;
    }

    if (!churchId) {
      toast.error('교회 정보를 확인할 수 없습니다.');
      return;
    }

    try {
      // 데이터베이스에서 직접 확인 (동기화 문제 방지)
      const { data: existingRecord, error: checkError } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', student.id)
        .eq('date', today)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRecord) {
        toast.error(`${student.name}님은 오늘 이미 출석 체크하셨습니다.`);
        return;
      }

      // 출석 체크 추가 (모든 필수 필드 검증)
      const { data, error } = await supabase
        .from('attendance')
        .insert([
          {
            student_id: student.id,
            church_id: churchId,
            date: today,
            checked_by: userId
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('출석 체크 DB 에러:', error);
        throw error;
      }

      // 출석 기록 다시 로드하여 UI 동기화
      await loadData();
      loadAttendanceData(); // 그래프 업데이트
      toast.success(`${student.name}님 출석 완료! ✓`, {
        icon: '✅',
        duration: 2000,
      });
    } catch (error) {
      console.error('출석 체크 실패:', error);
      toast.error('출석 체크에 실패했습니다.');
    }
  };

  // 출석 취소
  const handleCancelAttendance = async (student: Student) => {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 데이터베이스에서 직접 삭제
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('student_id', student.id)
        .eq('date', today);

      if (error) throw error;

      // 출석 기록 다시 로드하여 UI 동기화
      await loadData();
      loadAttendanceData(); // 그래프 업데이트
      toast(`${student.name}님 출석 취소됨`, {
        icon: '↩️',
        duration: 2000,
      });
    } catch (error) {
      console.error('출석 취소 실패:', error);
      toast.error('출석 취소에 실패했습니다.');
    }
  };

  // 오늘 출석한 학생 ID 목록
  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceRecords
      .filter(record => record.date === today)
      .map(record => record.student_id);
  };

  const todayAttendanceIds = getTodayAttendance();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!church) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-base font-bold text-gray-900 mb-1">교회를 찾을 수 없습니다</p>
          <p className="text-xs text-gray-500">잘못된 접근이거나 삭제된 교회입니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 상단 투명 바 - 뒤로가기 및 설정 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold">{church.name}</span>
          </Link>
          <div className="relative management-menu-container">
            <button
              onClick={() => setShowManagementMenu(!showManagementMenu)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* 팝다운 메뉴 */}
            {showManagementMenu && (
              <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-slide-down z-50">
                <div className="p-2">
                  <div
                    onClick={() => {
                      setShowAnnouncementModal(true);
                      setShowManagementMenu(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">공지 작성</p>
                      <p className="text-xs text-gray-500">공지사항 등록</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setShowPrayerModal(true);
                      setShowManagementMenu(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-xl">🙏</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">기도 등록</p>
                      <p className="text-xs text-gray-500">기도제목 작성</p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setActiveTab('prayer');
                      setShowManagementMenu(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-2a3 3 0 00-3 3v2zm-7 0H5v-2a3 3 0 013-3h2a3 3 0 013 3v2zm6-10a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">인원 관리</p>
                      <p className="text-xs text-gray-500">학생/교사 등록</p>
                    </div>
                  </div>

                  <Link href={`/church/${churchId}/calendar`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">교회 달력</p>
                        <p className="text-xs text-gray-500">일정 관리</p>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/church/${churchId}/service-schedule`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">봉사자</p>
                        <p className="text-xs text-gray-500">봉사자 배정</p>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/church/${churchId}/offerings`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                        <span className="text-xl">💰</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">헌금 관리</p>
                        <p className="text-xs text-gray-500">헌금 기록</p>
                      </div>
                    </div>
                  </Link>

                  <Link href={`/church/${churchId}/expenses`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">지출 기록</p>
                        <p className="text-xs text-gray-500">부서 지출</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-20">
        {/* 탭 메뉴 */}
        <div className="mb-5 grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            출석
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'announcements'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            공지
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            일정
          </button>
          <button
            onClick={() => setActiveTab('기도' as any)}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === '기도'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            기도
          </button>
        </div>

        {/* 기존 관리메뉴 섹션 제거 */}
        {/* 새로운 기능 메뉴 */}
        <div className="mb-5 hidden">
          <button
            onClick={() => setShowManagementMenu(!showManagementMenu)}
            className="w-full flex items-center justify-between mb-3 px-4 py-3 rounded-lg border-2 border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
          >
            <span>관리 메뉴</span>
            <svg
              className={`w-5 h-5 transition-transform ${showManagementMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showManagementMenu && (
            <div className="grid grid-cols-2 gap-3 animate-slide-down">
              <Link href={`/church/${churchId}/calendar`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">교회 달력</p>
                      <p className="text-xs text-gray-500">일정 관리</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href={`/church/${churchId}/service-schedule`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-purple-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">봉사자</p>
                      <p className="text-xs text-gray-500">봉사자 배정</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href={`/church/${churchId}/prayer`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-green-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-2xl">🙏</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">기도제목</p>
                      <p className="text-xs text-gray-500">함께 기도</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href={`/church/${churchId}/offerings`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-yellow-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">헌금 관리</p>
                      <p className="text-xs text-gray-500">헌금 기록</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href={`/church/${churchId}/expenses`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-red-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">지출 기록</p>
                      <p className="text-xs text-gray-500">부서 지출</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href={`/church/${churchId}/announcements`}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">공지사항</p>
                      <p className="text-xs text-gray-500">공지 관리</p>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-600">성경 읽기</p>
                    <p className="text-xs text-gray-400">준비 중</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 출석 체크 탭 */}
        {activeTab === 'attendance' && (
          <div>
            {/* 오늘 날짜 */}
            <div className="mb-4 text-center">
              <p className="text-xs text-gray-500">오늘</p>
              <p className="text-lg font-bold text-gray-900">
                {new Date().toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}
              </p>
            </div>

            {/* 출석 체크 버튼 */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setAttendanceModalType('student');
                  setShowAttendanceModal(true);
                }}
                className="rounded-2xl bg-white p-5 shadow-md hover:shadow-lg active:scale-95 transition-all border-2 border-green-100 hover:border-green-200"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-gray-900">학생 출석</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {students.filter(s => s.type === 'student').length}명
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setAttendanceModalType('teacher');
                  setShowAttendanceModal(true);
                }}
                className="rounded-2xl bg-white p-5 shadow-md hover:shadow-lg active:scale-95 transition-all border-2 border-purple-100 hover:border-purple-200"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-gray-900">교사 출석</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {students.filter(s => s.type === 'teacher').length}명
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* 출석 현황 그래프 - Chart.js */}
            {(weeklyAttendance.length > 0 || monthlyAttendance.length > 0) && (
              <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">출석 현황</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {viewMode === 'weekly' ? '최근 7일' : '최근 4주'}
                    </p>
                  </div>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('weekly')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        viewMode === 'weekly'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      주간
                    </button>
                    <button
                      onClick={() => setViewMode('monthly')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        viewMode === 'monthly'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      월간
                    </button>
                  </div>
                </div>

                {/* Chart.js 라인 그래프 */}
                <div className="h-48 mb-2">
                  <Line
                    data={{
                      labels: (viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).map(item => {
                        const date = new Date(item.date);
                        return viewMode === 'weekly'
                          ? date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }).replace('. ', '/')
                          : item.date;
                      }),
                      datasets: [
                        {
                          label: '출석',
                          data: (viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).map(item => item.count),
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: (context: any) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                            return gradient;
                          },
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4,
                          pointRadius: 5,
                          pointHoverRadius: 7,
                          pointBackgroundColor: 'rgb(59, 130, 246)',
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2,
                          pointHoverBackgroundColor: 'rgb(37, 99, 235)',
                          pointHoverBorderColor: '#fff',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          titleColor: '#1F2937',
                          bodyColor: '#3B82F6',
                          borderColor: '#E5E7EB',
                          borderWidth: 1,
                          padding: 12,
                          displayColors: false,
                          bodyFont: {
                            size: 14,
                            weight: 'bold',
                          },
                          callbacks: {
                            label: (context: any) => `${context.parsed.y}명`,
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false,
                          },
                          ticks: {
                            font: {
                              size: 11,
                            },
                            color: '#6B7280',
                          },
                        },
                        y: {
                          beginAtZero: true,
                          border: {
                            display: false,
                          },
                          grid: {
                            color: '#F3F4F6',
                          },
                          ticks: {
                            font: {
                              size: 11,
                            },
                            color: '#6B7280',
                            stepSize: 1,
                          },
                        },
                      },
                      interaction: {
                        intersect: false,
                        mode: 'index',
                      },
                    }}
                  />
                </div>

                {/* 총계 */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">총 출석</span>
                  <span className="text-lg font-bold text-blue-700">
                    {(viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).reduce((sum, item) => sum + item.count, 0)}명
                  </span>
                </div>
              </div>
            )}

            {/* 전체 출석 통계 */}
            <div className="mb-5 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                이번 달 통계
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* 교사 평균 출석률 */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-gray-600 mb-2">교사 평균 출석률</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-purple-600">
                      {students.filter(s => s.type === 'teacher').length > 0
                        ? Math.round(
                            students
                              .filter(s => s.type === 'teacher')
                              .reduce((sum, s) => sum + getStudentAttendanceStats(s.id).attendanceRate, 0) /
                            students.filter(s => s.type === 'teacher').length
                          )
                        : 0}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">%</span>
                  </div>
                </div>

                {/* 학생 평균 출석률 */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-gray-600 mb-2">학생 평균 출석률</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-green-600">
                      {students.filter(s => s.type === 'student').length > 0
                        ? Math.round(
                            students
                              .filter(s => s.type === 'student')
                              .reduce((sum, s) => sum + getStudentAttendanceStats(s.id).attendanceRate, 0) /
                            students.filter(s => s.type === 'student').length
                          )
                        : 0}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">%</span>
                  </div>
                </div>

                {/* 총 출석 횟수 */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-gray-600 mb-2">이번 달 총 출석</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-blue-600">
                      {attendanceRecords.filter(r => {
                        const recordDate = new Date(r.date);
                        const today = new Date();
                        return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
                      }).length}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">회</span>
                  </div>
                </div>

                {/* 전체 누적 출석 */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-gray-600 mb-2">전체 누적 출석</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {attendanceRecords.length}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">회</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* 출석 달력 탭 */}
        {activeTab === 'calendar' && (
          <AttendanceCalendar
            students={students}
            attendanceRecords={attendanceRecords}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onAttendanceUpdate={() => {
              loadData();
              loadAttendanceData();
            }}
          />
        )}

        {/* 공지사항 탭 */}
        {activeTab === 'announcements' && (
          <Announcements
            key={announcementKey}
            churchId={churchId}
            userId={userId}
            isAdmin={isAdmin}
          />
        )}

        {/* 인원 관리 탭 */}
        {activeTab === 'prayer' && (
          <div>
            <button
              onClick={() => setShowAddStudentModal(true)}
              className="mb-3 w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            >
              <div className="text-2xl mb-0.5">+</div>
              <div className="text-xs font-bold">새 인원 등록</div>
            </button>

            {students.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <div className="mb-2 text-4xl">📋</div>
                <p className="text-sm font-bold text-gray-900 mb-1">등록된 인원이 없어요</p>
                <p className="text-xs text-gray-500">
                  위 버튼을 눌러 첫 번째 인원을 등록해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-xl bg-white border border-gray-200 p-3 hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* 학생 사진 */}
                      {student.photo_url ? (
                        <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 border border-gray-200">
                          <Image
                            src={student.photo_url}
                            alt={student.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-lg">
                          👤
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="text-sm font-bold text-gray-900">{student.name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${
                            student.type === 'teacher'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {student.type === 'teacher' ? '교사' : '학생'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          {student.grade && <span className="whitespace-nowrap">{student.grade}</span>}
                          {student.age && <span className="whitespace-nowrap">{student.age}세</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 기도 탭 */}
        {activeTab === '기도' && (
          <div className="space-y-3">
            {prayers.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <div className="mb-2 text-4xl">🙏</div>
                <p className="text-sm font-bold text-gray-900 mb-1">등록된 기도제목이 없습니다</p>
                <p className="text-xs text-gray-500 mb-3">새로운 기도제목을 등록해보세요</p>
                <button
                  onClick={() => setShowPrayerModal(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all"
                >
                  기도제목 등록
                </button>
              </div>
            ) : (
              prayers.map((prayer) => (
                <Link key={prayer.id} href={`/church/${churchId}/prayer/${prayer.id}`}>
                  <div
                    className={`rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ${
                      prayer.is_answered
                        ? 'border-green-200 bg-green-50 hover:border-green-300'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {prayer.is_answered && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                              응답됨
                            </span>
                          )}
                          {prayer.is_anonymous ? (
                            <span className="text-xs font-semibold text-gray-500">익명</span>
                          ) : prayer.student ? (
                            <span className="text-xs font-semibold text-blue-600">{prayer.student.name}</span>
                          ) : (
                            <span className="text-xs font-semibold text-gray-500">작성자</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(prayer.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">{prayer.title}</h4>
                        <p className="text-xs text-gray-600 line-clamp-2">{prayer.content}</p>
                        {prayer.answer_testimony && (
                          <div className="mt-2 rounded-lg bg-white p-2 border border-green-200">
                            <p className="text-xs font-semibold text-green-700 mb-1">감사 간증</p>
                            <p className="text-xs text-gray-700 line-clamp-2">{prayer.answer_testimony}</p>
                          </div>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#374151',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            fontSize: '14px',
            fontWeight: '600',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* 인원 등록 모달 - 토스 스타일 바텀시트 */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                새 인원 등록
              </h2>
              <p className="text-sm text-gray-500">
                정보를 입력해주세요
              </p>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              {/* 교사/학생 선택 */}
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  구분
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStudent({ ...newStudent, type: 'student' })}
                    className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      newStudent.type === 'student'
                        ? 'bg-green-600 text-white shadow-[0_4px_14px_0_rgba(22,163,74,0.4)]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    학생
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStudent({ ...newStudent, type: 'teacher' })}
                    className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      newStudent.type === 'teacher'
                        ? 'bg-purple-600 text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.4)]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    교사
                  </button>
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  사진
                </label>
                <ImageUpload
                  onImageSelect={(file) => setSelectedPhoto(file)}
                  onImageRemove={() => setSelectedPhoto(null)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  이름
                </label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  전화번호 (선택)
                </label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-bold text-gray-900">
                    나이 (선택)
                  </label>
                  <input
                    type="number"
                    value={newStudent.age}
                    onChange={(e) => setNewStudent({ ...newStudent, age: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                    placeholder="15"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-bold text-gray-900">
                    학년 (선택)
                  </label>
                  <input
                    type="text"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                    placeholder="중1"
                  />
                </div>
              </div>

              {/* 출석 요일 선택 */}
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  출석 요일 선택
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {[
                    { value: '0', label: '일' },
                    { value: '1', label: '월' },
                    { value: '2', label: '화' },
                    { value: '3', label: '수' },
                    { value: '4', label: '목' },
                    { value: '5', label: '금' },
                    { value: '6', label: '토' }
                  ].map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleAttendanceDay(day.value)}
                      className={`rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${
                        newStudent.attendance_days?.includes(day.value)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  선택한 요일에만 출석이 가능합니다
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setNewStudent({ name: '', phone: '', age: '', grade: '', type: 'student', attendance_days: ['0', '1', '2', '3', '4', '5', '6'] });
                    setSelectedPhoto(null);
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 학생 편집 모달 */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                정보 수정
              </h2>
              <p className="text-sm text-gray-500">
                {editingStudent.name}님의 정보를 수정합니다
              </p>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              {/* 교사/학생 선택 */}
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  구분
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent({ ...editingStudent, type: 'student' })}
                    className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      editingStudent.type === 'student'
                        ? 'bg-green-600 text-white shadow-[0_4px_14px_0_rgba(22,163,74,0.4)]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    학생
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStudent({ ...editingStudent, type: 'teacher' })}
                    className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                      editingStudent.type === 'teacher'
                        ? 'bg-purple-600 text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.4)]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    교사
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  이름
                </label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  전화번호 (선택)
                </label>
                <input
                  type="tel"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-bold text-gray-900">
                    나이 (선택)
                  </label>
                  <input
                    type="number"
                    value={editingStudent.age || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, age: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                    placeholder="15"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-bold text-gray-900">
                    학년 (선택)
                  </label>
                  <input
                    type="text"
                    value={editingStudent.grade || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                    placeholder="중1"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  메모 (선택)
                </label>
                <textarea
                  value={editingStudent.notes || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, notes: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="특이사항, 알레르기, 연락처 등을 메모하세요"
                  rows={4}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 공지 작성 모달 */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">공지사항 작성</h2>
              <p className="text-sm text-gray-500">제목과 내용을 입력해주세요</p>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">제목</label>
                <input
                  type="text"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 이번 주 일정 안내"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">내용</label>
                <textarea
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  rows={6}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">카테고리</label>
                <select
                  value={newAnnouncement.category}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, category: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="일반">일반</option>
                  <option value="행사">행사</option>
                  <option value="예배">예배</option>
                  <option value="긴급">긴급</option>
                  <option value="공지">공지</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pin-announcement"
                  checked={newAnnouncement.is_pinned}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, is_pinned: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-600"
                />
                <label htmlFor="pin-announcement" className="text-sm font-medium text-gray-700">
                  📌 상단 고정
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnnouncementModal(false);
                    setNewAnnouncement({
                      title: '',
                      content: '',
                      category: '일반',
                      is_pinned: false
                    });
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 출석 체크 모달 */}
      {showAttendanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowAttendanceModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-extrabold text-gray-900">
                  {attendanceModalType === 'student' ? '학생 출석 체크' : '교사 출석 체크'}
                </h2>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>

            {students.filter(s => s.type === attendanceModalType).length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="mb-3 text-5xl">👥</div>
                <p className="text-base font-bold text-gray-900 mb-2">
                  등록된 {attendanceModalType === 'student' ? '학생' : '교사'}이 없어요
                </p>
                <p className="text-sm text-gray-500">
                  인원 관리에서 먼저 등록해주세요
                </p>
              </div>
            ) : (
              <>
                {/* 오늘 출석 가능한 인원 */}
                {(() => {
                  const todayDayOfWeek = new Date().getDay().toString();
                  const availableStudents = students.filter(s =>
                    s.type === attendanceModalType &&
                    (s.attendance_days?.includes(todayDayOfWeek) || !s.attendance_days || s.attendance_days.length === 0)
                  );
                  const unavailableStudents = students.filter(s =>
                    s.type === attendanceModalType &&
                    s.attendance_days &&
                    s.attendance_days.length > 0 &&
                    !s.attendance_days.includes(todayDayOfWeek)
                  );

                  return (
                    <>
                      {availableStudents.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-gray-700 mb-3 px-1">오늘 출석 가능 ({availableStudents.length}명)</h3>
                          <div className="grid grid-cols-3 gap-3">
                            {availableStudents.map((student) => {
                  const isChecked = todayAttendanceIds.includes(student.id);
                  const stats = getStudentAttendanceStats(student.id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => isChecked ? handleCancelAttendance(student) : handleCheckAttendance(student)}
                      className={`relative rounded-2xl p-4 transition-all active:scale-95 ${
                        isChecked
                          ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={`이번 달: ${stats.thisMonthAttendance}회 | 출석률: ${stats.attendanceRate}%`}
                    >
                      {/* 체크 표시 */}
                      {isChecked && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      {/* 사진 */}
                      <div className="mb-2">
                        {student.photo_url ? (
                          <div className="relative w-16 h-16 mx-auto rounded-full overflow-hidden border-3 border-white/50">
                            <Image
                              src={student.photo_url}
                              alt={student.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl ${
                            isChecked ? 'bg-white/20' : 'bg-white'
                          }`}>
                            {attendanceModalType === 'student' ? '👨‍🎓' : '👨‍🏫'}
                          </div>
                        )}
                      </div>

                      {/* 이름 */}
                      <p className={`text-sm font-bold truncate ${
                        isChecked ? 'text-white' : 'text-gray-900'
                      }`}>
                        {student.name}
                      </p>

                      {/* 추가 정보 */}
                      {(student.grade || student.age) && (
                        <p className={`text-xs truncate mt-0.5 ${
                          isChecked ? 'text-white/80' : 'text-gray-500'
                        }`}>
                          {student.grade || `${student.age}세`}
                        </p>
                      )}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      )}

                      {/* 출석 불가능한 인원 */}
                      {unavailableStudents.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-gray-500 mb-3 px-1">오늘 출석 불가 ({unavailableStudents.length}명)</h3>
                          <div className="grid grid-cols-3 gap-3">
                            {unavailableStudents.map((student) => {
                              const stats = getStudentAttendanceStats(student.id);
                              return (
                                <button
                                  key={student.id}
                                  onClick={() => toast.info(`${student.name}님은 오늘 출석 요일이 아닙니다.\n인원 관리에서 출석 요일을 변경할 수 있습니다.`, { duration: 3000 })}
                                  className="relative rounded-2xl p-4 bg-gray-50 opacity-60 cursor-not-allowed"
                                  title={`이번 달: ${stats.thisMonthAttendance}회 | 출석률: ${stats.attendanceRate}%`}
                                >
                                  {/* 사진 */}
                                  <div className="mb-2">
                                    {student.photo_url ? (
                                      <div className="relative w-16 h-16 mx-auto rounded-full overflow-hidden border-2 border-gray-300 grayscale">
                                        <Image
                                          src={student.photo_url}
                                          alt={student.name}
                                          fill
                                          className="object-cover"
                                          unoptimized
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-3xl grayscale">
                                        {attendanceModalType === 'student' ? '👨‍🎓' : '👨‍🏫'}
                                      </div>
                                    )}
                                  </div>

                                  {/* 이름 */}
                                  <p className="text-sm font-bold truncate text-gray-500">
                                    {student.name}
                                  </p>

                                  {/* 추가 정보 */}
                                  {(student.grade || student.age) && (
                                    <p className="text-xs truncate mt-0.5 text-gray-400">
                                      {student.grade || `${student.age}세`}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* 기도 등록 모달 */}
      {showPrayerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">기도제목 등록</h2>
              <p className="text-sm text-gray-500">함께 기도할 제목을 등록해주세요</p>
            </div>

            <form onSubmit={handleCreatePrayer} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">제목</label>
                <input
                  type="text"
                  value={newPrayer.title}
                  onChange={(e) => setNewPrayer({ ...newPrayer, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 시험 합격을 위한 기도"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">내용</label>
                <textarea
                  value={newPrayer.content}
                  onChange={(e) => setNewPrayer({ ...newPrayer, content: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="기도제목을 자세히 적어주세요"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-900">카테고리</label>
                  <select
                    value={newPrayer.category}
                    onChange={(e) => setNewPrayer({ ...newPrayer, category: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="일반">일반</option>
                    <option value="개인">개인</option>
                    <option value="가족">가족</option>
                    <option value="건강">건강</option>
                    <option value="학업">학업</option>
                    <option value="진로">진로</option>
                    <option value="관계">관계</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-900">상태</label>
                  <select
                    value={newPrayer.status}
                    onChange={(e) => setNewPrayer({ ...newPrayer, status: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="진행중">진행중</option>
                    <option value="응답됨">응답됨</option>
                    <option value="대기중">대기중</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">대상자 (선택)</label>
                <select
                  value={newPrayer.student_id}
                  onChange={(e) => setNewPrayer({ ...newPrayer, student_id: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:outline-none"
                  disabled={newPrayer.is_anonymous}
                >
                  <option value="">선택 안 함</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={newPrayer.is_anonymous}
                  onChange={(e) => setNewPrayer({
                    ...newPrayer,
                    is_anonymous: e.target.checked,
                    student_id: e.target.checked ? '' : newPrayer.student_id
                  })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <label htmlFor="anonymous" className="text-sm font-medium text-gray-700">
                  익명으로 등록
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPrayerModal(false);
                    setNewPrayer({
                      title: '',
                      content: '',
                      is_anonymous: false,
                      student_id: '',
                      category: '일반',
                      status: '진행중'
                    });
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
