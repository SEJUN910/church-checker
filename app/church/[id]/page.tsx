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
  const [activeTab, setActiveTab] = useState<'attendance' | 'students' | 'calendar' | 'announcements'>('attendance');
  const [attendanceType, setAttendanceType] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [weeklyAttendance, setWeeklyAttendance] = useState<AttendanceData[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceData[]>([]);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [showManagementMenu, setShowManagementMenu] = useState(() => {
    // localStorage에서 관리 메뉴 상태 불러오기
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showManagementMenu');
      return saved === 'true';
    }
    return false;
  });

  const supabase = createClient();

  // 새 학생 등록 폼
  const [newStudent, setNewStudent] = useState({
    name: '',
    phone: '',
    age: '',
    grade: '',
    type: 'student' as 'student' | 'teacher'
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  // 관리 메뉴 상태가 변경될 때 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showManagementMenu', showManagementMenu.toString());
    }
  }, [showManagementMenu]);

  // 데이터 로드
  useEffect(() => {
    loadData();
    checkUser();
    loadAttendanceData();
  }, [churchId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let currentUserId: string;

    if (user) {
      currentUserId = user.id;
      setUserId(user.id);
    } else {
      const tempUserId = localStorage.getItem('tempUserId') || crypto.randomUUID();
      localStorage.setItem('tempUserId', tempUserId);
      currentUserId = tempUserId;
      setUserId(tempUserId);
    }

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

      // 월간 데이터 (최근 4주)
      const monthlyData: AttendanceData[] = [];
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date(today);
        endDate.setDate(today.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);

        const { data, error } = await supabase
          .from('attendance')
          .select('student_id')
          .eq('church_id', churchId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (error) throw error;

        // 중복 제거
        const uniqueStudents = new Set(data?.map(a => a.student_id) || []);
        const weekLabel = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
        monthlyData.push({
          date: weekLabel,
          count: uniqueStudents.size
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
            registered_by: userId
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
      setNewStudent({ name: '', phone: '', age: '', grade: '', type: 'student' });
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
    const alreadyChecked = attendanceRecords.some(
      record => record.student_id === student.id && record.date === today
    );

    if (alreadyChecked) {
      alert(`${student.name}님은 오늘 이미 출석 체크하셨습니다.`);
      return;
    }

    try {
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

      if (error) throw error;

      setAttendanceRecords([data, ...attendanceRecords]);
      alert(`${student.name}님 출석 체크 완료!`);
    } catch (error) {
      console.error('출석 체크 실패:', error);
      alert('출석 체크에 실패했습니다.');
    }
  };

  // 출석 취소
  const handleCancelAttendance = async (student: Student) => {
    const today = new Date().toISOString().split('T')[0];
    const attendanceRecord = attendanceRecords.find(
      record => record.student_id === student.id && record.date === today
    );

    if (!attendanceRecord) return;

    if (!confirm(`${student.name}님의 출석을 취소하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendanceRecord.id);

      if (error) throw error;

      setAttendanceRecords(attendanceRecords.filter(a => a.id !== attendanceRecord.id));
      alert(`${student.name}님 출석 취소 완료`);
    } catch (error) {
      console.error('출석 취소 실패:', error);
      alert('출석 취소에 실패했습니다.');
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
      {/* 상단 투명 바 - 뒤로가기 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold">목록</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-20">
        {/* 헤더 카드 */}
        <div className="mb-5 rounded-xl bg-white border border-gray-200 p-5">
          <h1 className="mb-1 text-xl font-bold text-gray-900">{church.name}</h1>
          {church.description && (
            <p className="text-xs text-gray-500 mb-3">{church.description}</p>
          )}
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-blue-50 p-2.5 text-center">
              <p className="text-xs text-blue-600 mb-0.5">등록</p>
              <p className="text-xl font-bold text-blue-600">{students.length}</p>
            </div>
            <div className="flex-1 rounded-lg bg-green-50 p-2.5 text-center">
              <p className="text-xs text-green-600 mb-0.5">출석</p>
              <p className="text-xl font-bold text-green-600">{todayAttendanceIds.length}</p>
            </div>
          </div>
        </div>

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
            onClick={() => setActiveTab('calendar')}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            달력
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
            onClick={() => setActiveTab('students')}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'students'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            인원
          </button>
        </div>

        {/* 새로운 기능 메뉴 */}
        <div className="mb-5">
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
            {/* 출석 현황 그래프 */}
            {(weeklyAttendance.length > 0 || monthlyAttendance.length > 0) && (
              <div className="mb-4 rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">출석 현황</h3>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('weekly')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        viewMode === 'weekly'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      주간
                    </button>
                    <button
                      onClick={() => setViewMode('monthly')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        viewMode === 'monthly'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      월간
                    </button>
                  </div>
                </div>

                {/* 그래프 */}
                <div className="space-y-3">
                  {(viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).map((item, index) => {
                    const maxCount = Math.max(...(viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).map(d => d.count));
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    const date = new Date(item.date);
                    const isToday = item.date === new Date().toISOString().split('T')[0];

                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-12 text-right">
                          <span className={`text-[10px] ${isToday ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                            {viewMode === 'weekly'
                              ? date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }).replace('. ', '/')
                              : item.date}
                          </span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isToday ? 'bg-blue-500' : 'bg-blue-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-6 text-right">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 총계 */}
                <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {viewMode === 'weekly' ? '주간' : '월간'} 총 출석
                  </span>
                  <span className="text-base font-bold text-blue-600">
                    {(viewMode === 'weekly' ? weeklyAttendance : monthlyAttendance).reduce((sum, item) => sum + item.count, 0)}명
                  </span>
                </div>
              </div>
            )}

            {/* 날짜 및 필터 */}
            <div className="mb-3 space-y-2">
              <div className="rounded-lg bg-blue-50 px-3 py-2.5 border border-blue-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-bold text-blue-800">
                  {new Date().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </p>
              </div>

              {/* 교사/학생 필터 */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAttendanceType('student')}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                    attendanceType === 'student'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  학생 {students.filter(s => s.type === 'student').length}
                </button>
                <button
                  onClick={() => setAttendanceType('teacher')}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                    attendanceType === 'teacher'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  교사 {students.filter(s => s.type === 'teacher').length}
                </button>
              </div>
            </div>

            {students.filter(s => s.type === attendanceType).length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <div className="mb-2 text-4xl">👥</div>
                <p className="text-sm font-bold text-gray-900 mb-1">등록된 {attendanceType === 'student' ? '학생' : '교사'}이 없어요</p>
                <p className="text-xs text-gray-500 mb-3">
                  인원 관리 탭에서 먼저 등록해주세요
                </p>
                <button
                  onClick={() => setActiveTab('students')}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all"
                >
                  인원 관리 →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {students.filter(s => s.type === attendanceType).map((student) => {
                  const isChecked = todayAttendanceIds.includes(student.id);
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                        isChecked
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleEditStudent(student)}
                      >
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
                          <h3 className="text-sm font-bold text-gray-900 truncate">{student.name}</h3>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            {student.grade && <span className="whitespace-nowrap">{student.grade}</span>}
                            {student.age && <span className="whitespace-nowrap">{student.age}세</span>}
                            {student.phone && <span className="whitespace-nowrap">{student.phone}</span>}
                          </div>
                        </div>
                      </div>
                      {isChecked ? (
                        <button
                          onClick={() => handleCancelAttendance(student)}
                          className="ml-2 rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
                          title="출석 취소"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckAttendance(student)}
                          className="ml-2 rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700 active:scale-95 transition-all"
                          title="출석 체크"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 출석 달력 탭 */}
        {activeTab === 'calendar' && (
          <AttendanceCalendar
            students={students}
            attendanceRecords={attendanceRecords}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
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
        {activeTab === 'students' && (
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
      </div>

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
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setNewStudent({ name: '', phone: '', age: '', grade: '', type: 'student' });
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
      `}</style>
    </div>
  );
}
