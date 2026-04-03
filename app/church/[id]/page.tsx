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
  birthdate: string | null;
  photo_url: string | null;
  type: 'student' | 'teacher' | 'parent' | 'other';
  created_at: string;
  memo: string | null;
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
  const [activeTab, setActiveTab] = useState<'attendance' | 'calendar' | 'announcements' | 'members'>('attendance');
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
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceModalType, setAttendanceModalType] = useState<'student' | 'teacher'>('student');

  const supabase = createClient();

  // 새 학생 등록 폼
  const [newStudent, setNewStudent] = useState({
    name: '',
    phone: '',
    birthdate: '',
    grade: '',
    type: 'student' as 'student' | 'teacher' | 'parent' | 'other',
    attendance_days: ['0'] // 기본값: 일요일만
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'student' | 'teacher' | 'parent' | 'other'>('student');

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

    // 1. 교회 owner인지 확인
    const { data: churchData } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    if (churchData?.owner_id === currentUserId) {
      // owner는 자동으로 admin 권한
      setIsAdmin(true);

      // church_members에 없으면 추가
      const { data: existingMember } = await supabase
        .from('church_members')
        .select('id')
        .eq('church_id', churchId)
        .eq('user_id', currentUserId)
        .single();

      if (!existingMember) {
        await supabase
          .from('church_members')
          .insert([{
            church_id: churchId,
            user_id: currentUserId,
            role: 'admin'
          }]);
      }
      return;
    }

    // 2. church_members에서 멤버십 및 역할 확인
    const { data: memberData } = await supabase
      .from('church_members')
      .select('role')
      .eq('church_id', churchId)
      .eq('user_id', currentUserId)
      .single();

    // 멤버가 아니면 메인 페이지로 리다이렉트
    if (!memberData) {
      alert('이 교회에 접근 권한이 없습니다.');
      router.push('/');
      return;
    }

    // 관리자 권한 확인
    setIsAdmin(memberData.role === 'admin');
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
              .from('members')
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

      // 필요한 날짜 범위 계산
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const currentDayOfWeek = today.getDay();
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - currentDayOfWeek);
      const fourWeeksAgo = new Date(thisWeekStart);
      fourWeeksAgo.setDate(thisWeekStart.getDate() - 21);

      // 전체 기간의 출석 데이터를 한 번에 가져오기 (4주 전부터 오늘까지)
      const startDate = fourWeeksAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const { data: allAttendance, error } = await supabase
        .from('attendance')
        .select('student_id, date')
        .eq('church_id', churchId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // 날짜별로 그룹화
      const attendanceByDate = new Map<string, Set<string>>();
      allAttendance?.forEach(record => {
        if (!attendanceByDate.has(record.date)) {
          attendanceByDate.set(record.date, new Set());
        }
        attendanceByDate.get(record.date)!.add(record.student_id);
      });

      // 주간 데이터 (최근 7일) - 클라이언트에서 처리
      const weeklyData: AttendanceData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const uniqueStudents = attendanceByDate.get(dateStr) || new Set();
        weeklyData.push({
          date: dateStr,
          count: uniqueStudents.size
        });
      }
      setWeeklyAttendance(weeklyData);

      // 월간 데이터 (이번 주 포함 4주) - 클라이언트에서 처리
      const monthlyData: AttendanceData[] = [];

      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(thisWeekStart);
        weekStart.setDate(thisWeekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // 해당 주의 모든 출석 수 계산
        let totalCount = 0;
        allAttendance?.forEach(record => {
          if (record.date >= weekStartStr && record.date <= weekEndStr) {
            totalCount++;
          }
        });

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

  // 만나이 계산 함수
  const calculateAge = (birthdate: string): number => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
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
        .from('members')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (studentsError) throw studentsError;

      // 생년월일이 있는 경우 자동으로 나이 계산
      const studentsWithAge = (studentsData || []).map(student => {
        if (student.birthdate && !student.age) {
          return {
            ...student,
            age: calculateAge(student.birthdate)
          };
        }
        return student;
      });

      setStudents(studentsWithAge);

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
        .from('members')
        .insert([
          {
            church_id: churchId,
            name: newStudent.name,
            phone: newStudent.phone || null,
            birthdate: newStudent.birthdate || null,
            grade: newStudent.grade || null,
            type: newStudent.type,
            created_by: userId,
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
            .from('members')
            .update({ photo_url: photoUrl })
            .eq('id', data.id);

          data.photo_url = photoUrl;
        }
      }

      setStudents([data, ...students]);
      setNewStudent({ name: '', phone: '', birthdate: '', grade: '', type: 'student', attendance_days: ['0'] });
      setSelectedPhoto(null);
      setShowAddStudentModal(false);
      toast.success('등록이 완료되었습니다!');
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
      const updateData: any = {
        name: editingStudent.name,
        phone: editingStudent.phone || null,
        birthdate: editingStudent.birthdate || null,
        grade: editingStudent.grade || null,
        type: editingStudent.type,
        memo: editingStudent.memo || null,
        attendance_days: editingStudent.attendance_days || ['0']
      };

      // 사진이 선택된 경우 업로드
      if (selectedPhoto) {
        const photoUrl = await uploadStudentPhoto(selectedPhoto, editingStudent.id, churchId);
        if (photoUrl) {
          updateData.photo_url = photoUrl;
        }
      }

      const { error } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', editingStudent.id);

      if (error) throw error;

      const updatedStudent = { ...editingStudent, ...updateData };
      setStudents(students.map(s => s.id === editingStudent.id ? updatedStudent : s));
      setShowEditStudentModal(false);
      setEditingStudent(null);
      setSelectedPhoto(null);
      toast.success('정보가 수정되었습니다!');
    } catch (error) {
      console.error('학생 정보 수정 실패:', error);
      toast.error('학생 정보를 수정하는데 실패했습니다.');
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('members')
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
      const { error } = await supabase
        .from('attendance')
        .insert([
          {
            student_id: student.id,
            church_id: churchId,
            date: today,
            checked_by: userId
          }
        ]);

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
    <div className="min-h-screen bg-[#fcf9f4] pb-6">
      {/* 상단 투명 바 - 뒤로가기 및 설정 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#fcf9f4]/85 backdrop-blur-md">
        <div className="mx-auto max-w-md px-5 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-[#1c1c19] hover:text-[#32617d] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <div>
              <span className="font-semibold text-[#1c1c19]">{church.name}</span>
              <p className="text-[10px] text-[#41484d] font-normal leading-tight">
                {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
            </div>
          </Link>
          <div className="relative management-menu-container">
            <button
              onClick={() => setShowManagementMenu(!showManagementMenu)}
              className="p-2 rounded-xl text-[#41484d] hover:bg-[#f0ede8] transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* 팝다운 메뉴 */}
            {showManagementMenu && (
              <div className="absolute right-0 top-12 w-60 bg-[#ffffff] rounded-2xl overflow-hidden animate-slide-down z-50 shadow-[0px_12px_32px_rgba(28,28,25,0.14)]">
                <div className="p-2">
                  {[
                    {
                      label: '공지 작성', sub: '공지사항 등록',
                      onClick: () => { setShowAnnouncementModal(true); setShowManagementMenu(false); },
                      icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    },
                    {
                      label: '기도 등록', sub: '기도제목 작성',
                      onClick: () => { setShowPrayerModal(true); setShowManagementMenu(false); },
                      icon: <span className="text-lg">🙏</span>
                    },
                    {
                      label: '인원 관리', sub: '인원 등록·수정',
                      onClick: () => { setActiveTab('members'); setShowManagementMenu(false); },
                      icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-2a3 3 0 00-3 3v2zm-7 0H5v-2a3 3 0 013-3h2a3 3 0 013 3v2zm6-10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    },
                  ].map((item) => (
                    <div key={item.label} onClick={item.onClick} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f6f3ee] transition-all cursor-pointer">
                      <div className="w-9 h-9 rounded-xl bg-[#f0ede8] flex items-center justify-center shrink-0">{item.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-[#1c1c19]">{item.label}</p>
                        <p className="text-xs text-[#41484d]">{item.sub}</p>
                      </div>
                    </div>
                  ))}

                  <div className="my-1.5 h-px bg-[#f0ede8]" />

                  {[
                    { label: '교회 달력', sub: '일정 관리', href: `/church/${churchId}/calendar`, icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
                    { label: '봉사자', sub: '봉사자 배정', href: `/church/${churchId}/service-schedule`, icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
                    { label: '헌금 관리', sub: '헌금 기록', href: `/church/${churchId}/offerings`, icon: <span className="text-lg">💰</span> },
                    { label: '지출 기록', sub: '부서 지출', href: `/church/${churchId}/expenses`, icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg> },
                    ...(isAdmin ? [{ label: '관리자 관리', sub: '멤버 초대', href: `/church/${churchId}/admins`, icon: <svg className="w-5 h-5 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> }] : []),
                  ].map((item) => (
                    <Link key={item.label} href={item.href}>
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f6f3ee] transition-all cursor-pointer">
                        <div className="w-9 h-9 rounded-xl bg-[#f0ede8] flex items-center justify-center shrink-0">{item.icon}</div>
                        <div>
                          <p className="text-sm font-semibold text-[#1c1c19]">{item.label}</p>
                          <p className="text-xs text-[#41484d]">{item.sub}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
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
            className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-all whitespace-nowrap text-center active:scale-95 ${
              activeTab === 'attendance'
                ? 'bg-[#32617d] text-white shadow-[0px_4px_12px_rgba(50,97,125,0.3)]'
                : 'bg-[#f0ede8] text-[#41484d] hover:bg-[#e5e2dd]'
            }`}
          >
            출석
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-all whitespace-nowrap text-center active:scale-95 ${
              activeTab === 'calendar'
                ? 'bg-[#32617d] text-white shadow-[0px_4px_12px_rgba(50,97,125,0.3)]'
                : 'bg-[#f0ede8] text-[#41484d] hover:bg-[#e5e2dd]'
            }`}
          >
            일정
          </button>
          <Link
            href={`/church/${churchId}/announcements`}
            className="rounded-xl px-2 py-2.5 text-xs font-semibold transition-all whitespace-nowrap bg-[#f0ede8] text-[#41484d] hover:bg-[#e5e2dd] flex items-center justify-center gap-1 active:scale-95"
          >
            공지
            <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
          <Link
            href={`/church/${churchId}/prayer`}
            className="rounded-xl px-2 py-2.5 text-xs font-semibold transition-all whitespace-nowrap bg-[#f0ede8] text-[#41484d] hover:bg-[#e5e2dd] flex items-center justify-center gap-1 active:scale-95"
          >
            기도
            <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>

        {/* 출석 체크 탭 */}
        {activeTab === 'attendance' && (
          <div>
            {/* 출석 체크 버튼 */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setAttendanceModalType('student');
                  setShowAttendanceModal(true);
                }}
                className="rounded-2xl bg-[#ffffff] p-5 active:scale-95 transition-all shadow-[0px_4px_20px_rgba(28,28,25,0.07)] hover:shadow-[0px_8px_28px_rgba(28,28,25,0.11)]"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 4px_12px_rgba(50,97,125,0.3)' }}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-[#1c1c19]">학생 출석</div>
                    <div className="text-sm text-[#41484d] mt-0.5">
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
                className="rounded-2xl bg-[#ffffff] p-5 active:scale-95 transition-all shadow-[0px_4px_20px_rgba(28,28,25,0.07)] hover:shadow-[0px_8px_28px_rgba(28,28,25,0.11)]"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#f0ede8] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#32617d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-[#1c1c19]">교사 출석</div>
                    <div className="text-sm text-[#41484d] mt-0.5">
                      {students.filter(s => s.type === 'teacher').length}명
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* 출석 현황 그래프 - Chart.js */}
            {(weeklyAttendance.length > 0 || monthlyAttendance.length > 0) && (
              <div className="mb-5 rounded-2xl bg-[#ffffff] p-5 shadow-[0px_4px_20px_rgba(28,28,25,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1c1c19]">출석 현황</h3>
                    <p className="text-xs text-[#41484d] mt-0.5">
                      {viewMode === 'weekly' ? '최근 7일' : '최근 4주'}
                    </p>
                  </div>
                  <div className="flex gap-1 bg-[#e5e2dd] rounded-xl p-1">
                    <button
                      onClick={() => setViewMode('weekly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        viewMode === 'weekly'
                          ? 'bg-[#32617d] text-white shadow-sm'
                          : 'text-[#41484d] hover:text-[#1c1c19]'
                      }`}
                    >
                      주간
                    </button>
                    <button
                      onClick={() => setViewMode('monthly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        viewMode === 'monthly'
                          ? 'bg-[#32617d] text-white shadow-sm'
                          : 'text-[#41484d] hover:text-[#1c1c19]'
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
                          borderColor: '#32617d',
                          backgroundColor: (context: any) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                            gradient.addColorStop(0, 'rgba(50, 97, 125, 0.18)');
                            gradient.addColorStop(1, 'rgba(50, 97, 125, 0)');
                            return gradient;
                          },
                          borderWidth: 2.5,
                          fill: true,
                          tension: 0.4,
                          pointRadius: 4,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#32617d',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2,
                          pointHoverBackgroundColor: '#254d63',
                          pointHoverBorderColor: '#ffffff',
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
                          backgroundColor: 'rgba(255, 255, 255, 0.97)',
                          titleColor: '#1c1c19',
                          bodyColor: '#32617d',
                          borderColor: 'rgba(193, 199, 205, 0.15)',
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
                <div className="mt-4 rounded-xl bg-[#f6f3ee] px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#41484d]">총 출석</span>
                  <span className="text-lg font-bold text-[#32617d]">
                    {(viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).reduce((sum, item) => sum + item.count, 0)}명
                  </span>
                </div>
              </div>
            )}

            {/* 전체 출석 통계 */}
            <div className="mb-5 rounded-2xl bg-[#f0ede8] p-4">
              <h3 className="text-sm font-semibold text-[#1c1c19] mb-3">이번 달 통계</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#ffffff] rounded-xl p-4 shadow-[0px_2px_8px_rgba(28,28,25,0.05)]">
                  <div className="text-xs text-[#41484d] mb-2">교사 평균 출석률</div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-[#32617d]">
                      {students.filter(s => s.type === 'teacher').length > 0
                        ? Math.round(
                            students
                              .filter(s => s.type === 'teacher')
                              .reduce((sum, s) => sum + getStudentAttendanceStats(s.id).attendanceRate, 0) /
                            students.filter(s => s.type === 'teacher').length
                          )
                        : 0}
                    </span>
                    <span className="text-sm text-[#41484d] mb-0.5">%</span>
                  </div>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-[0px_2px_8px_rgba(28,28,25,0.05)]">
                  <div className="text-xs text-[#41484d] mb-2">학생 평균 출석률</div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-[#32617d]">
                      {students.filter(s => s.type === 'student').length > 0
                        ? Math.round(
                            students
                              .filter(s => s.type === 'student')
                              .reduce((sum, s) => sum + getStudentAttendanceStats(s.id).attendanceRate, 0) /
                            students.filter(s => s.type === 'student').length
                          )
                        : 0}
                    </span>
                    <span className="text-sm text-[#41484d] mb-0.5">%</span>
                  </div>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-[0px_2px_8px_rgba(28,28,25,0.05)]">
                  <div className="text-xs text-[#41484d] mb-2">이번 달 총 출석</div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-[#32617d]">
                      {attendanceRecords.filter(r => {
                        const recordDate = new Date(r.date);
                        const today = new Date();
                        return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
                      }).length}
                    </span>
                    <span className="text-sm text-[#41484d] mb-0.5">회</span>
                  </div>
                </div>

                <div className="bg-[#ffffff] rounded-xl p-4 shadow-[0px_2px_8px_rgba(28,28,25,0.05)]">
                  <div className="text-xs text-[#41484d] mb-2">전체 누적 출석</div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-[#1c1c19]">
                      {attendanceRecords.length}
                    </span>
                    <span className="text-sm text-[#41484d] mb-0.5">회</span>
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
            churchId={churchId}
            userId={userId}
            isAdmin={isAdmin}
          />
        )}

        {/* 인원 관리 탭 */}
        {activeTab === 'members' && (
          <div>
            <button
              onClick={() => setShowAddStudentModal(true)}
              className="mb-3 w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            >
              <div className="text-2xl mb-0.5">+</div>
              <div className="text-xs font-bold">새 인원 등록</div>
            </button>

            {/* 검색 및 필터 */}
            {students.length > 0 && (
              <div className="mb-3 space-y-2">
                {/* 검색창 */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="이름으로 검색..."
                    className="w-full py-2 pl-10 pr-4 rounded-lg border-2 border-gray-200 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* 타입 필터 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTypeFilter('student')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      typeFilter === 'student'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    학생
                  </button>
                  <button
                    onClick={() => setTypeFilter('teacher')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      typeFilter === 'teacher'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    교사
                  </button>
                  <button
                    onClick={() => setTypeFilter('parent')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      typeFilter === 'parent'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    학부모
                  </button>
                  <button
                    onClick={() => setTypeFilter('other')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      typeFilter === 'other'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    기타
                  </button>
                </div>
              </div>
            )}

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
                {students
                  .filter(s =>
                    s.type === typeFilter &&
                    (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((student) => (
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditStudent(student)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1c19]/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-[#fcf9f4] p-6 pb-10 animate-slide-up max-h-[90vh] overflow-y-auto shadow-[0px_-20px_40px_rgba(28,28,25,0.08)]">
            {/* 핸들 */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#c1c7cd]/50" />

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1c1c19] mb-1" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                새 인원 등록
              </h2>
              <p className="text-sm text-[#41484d]">정보를 입력해주세요</p>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-5">
              {/* 구분 선택 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#41484d]">구분</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['student', 'teacher', 'parent', 'other'] as const).map((t) => {
                    const labels = { student: '학생', teacher: '교사', parent: '학부모', other: '기타' };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewStudent({ ...newStudent, type: t })}
                        className={`rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                          newStudent.type === t
                            ? 'bg-[#32617d] text-white shadow-[0px_4px_14px_rgba(50,97,125,0.35)]'
                            : 'bg-[#e5e2dd] text-[#41484d] hover:bg-[#dedad4]'
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#41484d]">사진</label>
                <ImageUpload
                  onImageSelect={(file) => setSelectedPhoto(file)}
                  onImageRemove={() => setSelectedPhoto(null)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">이름</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base font-medium text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="예: 홍길동"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">전화번호 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">생년월일 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="date"
                  value={newStudent.birthdate}
                  onChange={(e) => setNewStudent({ ...newStudent, birthdate: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                />
                {newStudent.birthdate && (
                  <p className="mt-1.5 text-xs text-[#41484d]">만 {calculateAge(newStudent.birthdate)}세</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">학년 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="text"
                  value={newStudent.grade}
                  onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="중1"
                />
              </div>

              {/* 출석 요일 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#41484d]">출석 요일</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {[
                    { value: '0', label: '일' },
                    { value: '1', label: '월' },
                    { value: '2', label: '화' },
                    { value: '3', label: '수' },
                    { value: '4', label: '목' },
                    { value: '5', label: '금' },
                    { value: '6', label: '토' },
                  ].map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleAttendanceDay(day.value)}
                      className={`rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                        newStudent.attendance_days?.includes(day.value)
                          ? 'bg-[#32617d] text-white shadow-[0px_4px_10px_rgba(50,97,125,0.3)]'
                          : 'bg-[#e5e2dd] text-[#41484d] hover:bg-[#dedad4]'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#41484d]/60">선택한 요일에만 출석이 가능합니다</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setNewStudent({ name: '', phone: '', birthdate: '', grade: '', type: 'student', attendance_days: ['0'] });
                    setSelectedPhoto(null);
                  }}
                  className="flex-1 rounded-2xl bg-[#f0ede8] py-4 text-base font-semibold text-[#1c1c19] hover:bg-[#e5e2dd] active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl py-4 text-base font-semibold text-white active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px 20px rgba(50,97,125,0.35)' }}
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 인원 편집 모달 */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1c19]/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-[#fcf9f4] p-6 pb-10 animate-slide-up max-h-[90vh] overflow-y-auto shadow-[0px_-20px_40px_rgba(28,28,25,0.08)]">
            {/* 핸들 */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#c1c7cd]/50" />

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1c1c19] mb-1" style={{ fontFamily: 'var(--font-noto-serif)' }}>
                정보 수정
              </h2>
              <p className="text-sm text-[#41484d]">{editingStudent.name}님의 정보를 수정합니다</p>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-5">
              {/* 구분 선택 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#41484d]">구분</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['student', 'teacher', 'parent', 'other'] as const).map((t) => {
                    const labels = { student: '학생', teacher: '교사', parent: '학부모', other: '기타' };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditingStudent({ ...editingStudent, type: t })}
                        className={`rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                          editingStudent.type === t
                            ? 'bg-[#32617d] text-white shadow-[0px_4px_14px_rgba(50,97,125,0.35)]'
                            : 'bg-[#e5e2dd] text-[#41484d] hover:bg-[#dedad4]'
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">이름</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base font-medium text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="예: 홍길동"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">전화번호 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="tel"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="010-1234-5678"
                />
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">사진 변경</label>
                <ImageUpload
                  currentImageUrl={editingStudent.photo_url || undefined}
                  onImageSelect={(file) => setSelectedPhoto(file)}
                  onImageRemove={() => setSelectedPhoto(null)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">생년월일 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="date"
                  value={editingStudent.birthdate || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, birthdate: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                />
                {editingStudent.birthdate && (
                  <p className="mt-1.5 text-xs text-[#41484d]">만 {calculateAge(editingStudent.birthdate)}세</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">학년 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <input
                  type="text"
                  value={editingStudent.grade || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30"
                  placeholder="중1"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#41484d]">메모 <span className="text-[#41484d]/50 font-normal">선택</span></label>
                <textarea
                  value={editingStudent.memo || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, memo: e.target.value })}
                  className="w-full rounded-xl bg-[#e5e2dd] px-4 py-3.5 text-base text-[#1c1c19] placeholder:text-[#41484d]/50 focus:outline-none focus:ring-2 focus:ring-[#32617d]/30 resize-none"
                  placeholder="특이사항, 알레르기, 연락처 등을 메모하세요"
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="flex-1 rounded-2xl bg-[#f0ede8] py-4 text-base font-semibold text-[#1c1c19] hover:bg-[#e5e2dd] active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl py-4 text-base font-semibold text-white active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #32617d, #4a8aaa)', boxShadow: '0px 8px 20px rgba(50,97,125,0.35)' }}
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
                                  onClick={() => toast(`${student.name}님은 오늘 출석 요일이 아닙니다.\n인원 관리에서 출석 요일을 변경할 수 있습니다.`, {
                                    icon: 'ℹ️',
                                    duration: 3000
                                  })}
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
