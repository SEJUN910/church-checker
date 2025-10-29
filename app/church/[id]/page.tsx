'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { uploadStudentPhoto } from '@/lib/supabase/storage';
import ImageUpload from './components/ImageUpload';
import AttendanceCalendar from './components/AttendanceCalendar';

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
  const [activeTab, setActiveTab] = useState<'attendance' | 'students' | 'calendar'>('attendance');
  const [attendanceType, setAttendanceType] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    if (user) {
      setUserId(user.id);
    } else {
      const tempUserId = localStorage.getItem('tempUserId') || crypto.randomUUID();
      localStorage.setItem('tempUserId', tempUserId);
      setUserId(tempUserId);
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!church) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>교회를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <header className="mb-6">
          <Link href="/" className="mb-4 inline-block text-blue-600 hover:text-blue-700">
            ← 목록으로 돌아가기
          </Link>
          <div className="rounded-xl bg-white p-6 shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="mb-2 text-3xl font-bold text-gray-800">{church.name}</h1>
                {church.description && (
                  <p className="text-gray-600">{church.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                  <span className="whitespace-nowrap">👥 등록 인원: {students.length}명</span>
                  <span className="whitespace-nowrap">✅ 오늘 출석: {todayAttendanceIds.length}명</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 탭 메뉴 */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-colors ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            출석 체크
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-colors ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            출석 달력
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition-colors ${
              activeTab === 'students'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            인원 관리
          </button>
        </div>

        {/* 출석 체크 탭 */}
        {activeTab === 'attendance' && (
          <div>
            {/* 날짜 및 필터 */}
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  📅 {new Date().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </p>
              </div>

              {/* 교사/학생 필터 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAttendanceType('student')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    attendanceType === 'student'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  학생 ({students.filter(s => s.type === 'student').length})
                </button>
                <button
                  onClick={() => setAttendanceType('teacher')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    attendanceType === 'teacher'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  교사 ({students.filter(s => s.type === 'teacher').length})
                </button>
              </div>
            </div>

            {students.filter(s => s.type === attendanceType).length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
                <div className="mb-2 text-4xl">👥</div>
                <p>등록된 {attendanceType === 'student' ? '학생' : '교사'}이 없습니다</p>
                <button
                  onClick={() => setActiveTab('students')}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  인원 관리로 이동하여 등록하기 →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {students.filter(s => s.type === attendanceType).map((student) => {
                  const isChecked = todayAttendanceIds.includes(student.id);
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between rounded-xl p-5 shadow-md transition-all ${
                        isChecked
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-white hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* 학생 사진 */}
                        {student.photo_url ? (
                          <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200">
                            <Image
                              src={student.photo_url}
                              alt={student.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-2xl">
                            👤
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-800">{student.name}</h3>
                            {isChecked && <span className="text-xl">✅</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                            {student.grade && <span className="whitespace-nowrap">📚 {student.grade}</span>}
                            {student.age && <span className="whitespace-nowrap">🎂 {student.age}세</span>}
                            {student.phone && <span className="whitespace-nowrap">📱 {student.phone}</span>}
                          </div>
                        </div>
                      </div>
                      {isChecked ? (
                        <button
                          onClick={() => handleCancelAttendance(student)}
                          className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
                        >
                          출석 취소
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckAttendance(student)}
                          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                        >
                          출석 체크
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

        {/* 인원 관리 탭 */}
        {activeTab === 'students' && (
          <div>
            <button
              onClick={() => setShowAddStudentModal(true)}
              className="mb-4 w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-5 text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-100"
            >
              <div className="text-2xl">+</div>
              <div className="mt-1 font-semibold">새 인원 등록</div>
            </button>

            {students.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
                <div className="mb-2 text-4xl">📋</div>
                <p>등록된 학생이 없습니다</p>
                <p className="mt-1 text-sm">위 버튼을 눌러 새로 등록하세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-xl bg-white p-5 shadow-md hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* 학생 사진 */}
                      {student.photo_url ? (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200">
                          <Image
                            src={student.photo_url}
                            alt={student.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-2xl">
                          👤
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-800">{student.name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded whitespace-nowrap ${
                            student.type === 'teacher'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {student.type === 'teacher' ? '교사' : '학생'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                          {student.grade && <span className="whitespace-nowrap">📚 {student.grade}</span>}
                          {student.age && <span className="whitespace-nowrap">🎂 {student.age}세</span>}
                          {student.phone && <span className="whitespace-nowrap">📱 {student.phone}</span>}
                        </div>
                        <p className="mt-1 text-xs text-gray-400 whitespace-nowrap">
                          등록일: {new Date(student.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      className="rounded-lg px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 인원 등록 모달 */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-3 text-xl font-bold text-gray-800">새 인원 등록</h2>
            <form onSubmit={handleAddStudent} className="space-y-3">
              {/* 교사/학생 선택 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  구분 *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStudent({ ...newStudent, type: 'student' })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      newStudent.type === 'student'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    학생
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStudent({ ...newStudent, type: 'teacher' })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      newStudent.type === 'teacher'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    교사
                  </button>
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  사진
                </label>
                <ImageUpload
                  onImageSelect={(file) => setSelectedPhoto(file)}
                  onImageRemove={() => setSelectedPhoto(null)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  이름 *
                </label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    나이
                  </label>
                  <input
                    type="number"
                    value={newStudent.age}
                    onChange={(e) => setNewStudent({ ...newStudent, age: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="15"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    학년
                  </label>
                  <input
                    type="text"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="중1"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setNewStudent({ name: '', phone: '', age: '', grade: '', type: 'student' });
                    setSelectedPhoto(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
