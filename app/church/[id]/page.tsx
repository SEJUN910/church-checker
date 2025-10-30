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

  // 데이터 로드
  useEffect(() => {
    loadData();
    checkUser();
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

        {/* 출석 체크 탭 */}
        {activeTab === 'attendance' && (
          <div>
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
