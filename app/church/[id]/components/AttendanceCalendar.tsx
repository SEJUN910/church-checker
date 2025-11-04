'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface AttendanceRecord {
  id: string
  student_id: string
  date: string
}

interface Student {
  id: string
  name: string
  type: string
  photo_url?: string | null
  grade?: string
  age?: string
}

interface AttendanceCalendarProps {
  students: Student[]
  attendanceRecords: AttendanceRecord[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onAttendanceUpdate: () => void
}

export default function AttendanceCalendar({
  students,
  attendanceRecords,
  currentMonth,
  onMonthChange,
  onAttendanceUpdate,
}: AttendanceCalendarProps) {
  const supabase = createClient()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDateAttendance, setSelectedDateAttendance] = useState<string[]>([])

  // 해당 월의 일수 계산
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()

  // 날짜별 출석 통계 계산
  const getAttendanceStats = (date: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    const dayRecords = attendanceRecords.filter(r => r.date === dateStr)

    const teacherIds = new Set(
      students.filter(s => s.type === 'teacher').map(s => s.id)
    )
    const studentIds = new Set(
      students.filter(s => s.type === 'student').map(s => s.id)
    )

    const teacherCount = dayRecords.filter(r => teacherIds.has(r.student_id)).length
    const studentCount = dayRecords.filter(r => studentIds.has(r.student_id)).length

    return { teacherCount, studentCount, total: dayRecords.length }
  }

  // 이전 달
  const prevMonth = () => {
    const newDate = new Date(year, month - 1, 1)
    onMonthChange(newDate)
  }

  // 다음 달
  const nextMonth = () => {
    const newDate = new Date(year, month + 1, 1)
    onMonthChange(newDate)
  }

  // 오늘로 이동
  const goToday = () => {
    onMonthChange(new Date())
  }

  // 오늘 날짜
  const today = new Date()
  const isToday = (date: number) => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === date
    )
  }

  // 날짜가 오늘 이전인지 확인
  const isPastOrToday = (date: number) => {
    const targetDate = new Date(year, month, date)
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return targetDate <= todayDate
  }

  // 날짜 클릭 핸들러
  const handleDateClick = (date: number) => {
    if (!isPastOrToday(date)) {
      toast.error('오늘 이전 날짜만 출석 체크가 가능합니다.')
      return
    }

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    setSelectedDate(dateStr)

    // 해당 날짜의 출석한 학생 ID 목록
    const attendedIds = attendanceRecords
      .filter(r => r.date === dateStr)
      .map(r => r.student_id)
    setSelectedDateAttendance(attendedIds)
  }

  // 출석 체크
  const handleCheckAttendance = async (student: Student, dateStr: string) => {
    // 이미 출석한 경우 체크
    if (selectedDateAttendance.includes(student.id)) {
      toast.error(`${student.name}님은 이미 출석 체크하셨습니다.`)
      return
    }

    try {
      const { data, error } = await supabase
        .from('attendance')
        .insert([
          {
            student_id: student.id,
            date: dateStr,
          }
        ])
        .select()
        .single()

      if (error) throw error

      // 상태 업데이트
      setSelectedDateAttendance([...selectedDateAttendance, student.id])

      // 부모 컴포넌트 데이터 새로고침
      onAttendanceUpdate()

      toast.success(`${student.name}님 출석 완료! ✓`, {
        icon: '✅',
        duration: 2000,
      })
    } catch (error: any) {
      console.error('출석 체크 실패:', error)
      // 중복 키 에러 처리
      if (error?.code === '23505') {
        toast.error(`${student.name}님은 이미 출석 체크하셨습니다.`)
      } else {
        toast.error('출석 체크에 실패했습니다.')
      }
    }
  }

  // 출석 취소
  const handleCancelAttendance = async (student: Student, dateStr: string) => {
    // 출석하지 않은 경우 체크
    if (!selectedDateAttendance.includes(student.id)) {
      toast.error(`${student.name}님은 출석 체크되지 않았습니다.`)
      return
    }

    const attendanceRecord = attendanceRecords.find(
      record => record.student_id === student.id && record.date === dateStr
    )

    if (!attendanceRecord) {
      toast.error('출석 기록을 찾을 수 없습니다.')
      return
    }

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendanceRecord.id)

      if (error) throw error

      // 상태 업데이트
      setSelectedDateAttendance(selectedDateAttendance.filter(id => id !== student.id))

      // 부모 컴포넌트 데이터 새로고침
      onAttendanceUpdate()

      toast.success(`${student.name}님 출석 취소됨`, {
        icon: '↩️',
        duration: 2000,
      })
    } catch (error) {
      console.error('출석 취소 실패:', error)
      toast.error('출석 취소에 실패했습니다.')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <button
          onClick={prevMonth}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
        >
          ←
        </button>
        <div className="flex items-center gap-2 flex-1 justify-center">
          <h2 className="text-lg font-bold text-gray-800 whitespace-nowrap">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={goToday}
            className="px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap"
          >
            오늘
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
        >
          →
        </button>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          <span>교사</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span>학생</span>
        </div>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div
            key={day}
            className={`text-center font-semibold py-2 ${
              i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-7 gap-2">
        {/* 빈 칸 (이전 달) */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square"></div>
        ))}

        {/* 실제 날짜 */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = i + 1
          const stats = getAttendanceStats(date)
          const isTodayDate = isToday(date)
          const canClick = isPastOrToday(date)

          return (
            <button
              key={date}
              onClick={() => handleDateClick(date)}
              disabled={!canClick}
              className={`aspect-square border rounded-lg p-2 flex flex-col items-center justify-between transition-all ${
                isTodayDate
                  ? 'border-2 border-blue-500 bg-blue-50'
                  : canClick
                  ? 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`text-sm font-semibold ${
                (startDayOfWeek + i) % 7 === 0
                  ? 'text-red-600'
                  : (startDayOfWeek + i) % 7 === 6
                  ? 'text-blue-600'
                  : 'text-gray-700'
              }`}>
                {date}
              </div>

              {stats.total > 0 && (
                <div className="flex flex-col gap-1 text-xs w-full">
                  {stats.teacherCount > 0 && (
                    <div className="flex items-center justify-center gap-1 bg-blue-100 rounded px-1 py-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-blue-700 font-medium">{stats.teacherCount}</span>
                    </div>
                  )}
                  {stats.studentCount > 0 && (
                    <div className="flex items-center justify-center gap-1 bg-green-100 rounded px-1 py-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-green-700 font-medium">{stats.studentCount}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 통계 요약 */}
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-600 mb-1 whitespace-nowrap">이번 달 교사 출석</div>
          <div className="text-xl font-bold text-blue-700">
            {attendanceRecords.filter(r => {
              const recordDate = new Date(r.date)
              return (
                recordDate.getFullYear() === year &&
                recordDate.getMonth() === month &&
                students.find(s => s.id === r.student_id)?.type === 'teacher'
              )
            }).length}
            <span className="text-xs font-normal ml-1">회</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-xs text-green-600 mb-1 whitespace-nowrap">이번 달 학생 출석</div>
          <div className="text-xl font-bold text-green-700">
            {attendanceRecords.filter(r => {
              const recordDate = new Date(r.date)
              return (
                recordDate.getFullYear() === year &&
                recordDate.getMonth() === month &&
                students.find(s => s.id === r.student_id)?.type === 'student'
              )
            }).length}
            <span className="text-xs font-normal ml-1">회</span>
          </div>
        </div>
      </div>

      {/* 날짜별 출석 모달 */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-extrabold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </h2>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500">
                출석: {selectedDateAttendance.length}명 / {students.length}명
              </p>
            </div>

            {students.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="mb-3 text-5xl">👥</div>
                <p className="text-base font-bold text-gray-900 mb-2">
                  등록된 인원이 없어요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 교사 섹션 */}
                {students.filter(s => s.type === 'teacher').length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 px-1">교사</h3>
                    <div className="space-y-2">
                      {students.filter(s => s.type === 'teacher').map((student) => {
                        const isChecked = selectedDateAttendance.includes(student.id)
                        return (
                          <button
                            key={student.id}
                            onClick={() => isChecked ? handleCancelAttendance(student, selectedDate) : handleCheckAttendance(student, selectedDate)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isChecked
                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-md'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {student.photo_url ? (
                              <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white/50">
                                <Image
                                  src={student.photo_url}
                                  alt={student.name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-2xl ${
                                isChecked ? 'bg-white/20' : 'bg-white'
                              }`}>
                                👨‍🏫
                              </div>
                            )}

                            <div className="flex-1 text-left">
                              <h3 className={`text-sm font-bold ${isChecked ? 'text-white' : 'text-gray-900'}`}>
                                {student.name}
                              </h3>
                              {(student.grade || student.age) && (
                                <p className={`text-xs mt-0.5 ${isChecked ? 'text-white/80' : 'text-gray-500'}`}>
                                  {student.grade || `${student.age}세`}
                                </p>
                              )}
                            </div>

                            {isChecked && (
                              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 학생 섹션 */}
                {students.filter(s => s.type === 'student').length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2 px-1">학생</h3>
                    <div className="space-y-2">
                      {students.filter(s => s.type === 'student').map((student) => {
                        const isChecked = selectedDateAttendance.includes(student.id)
                        return (
                          <button
                            key={student.id}
                            onClick={() => isChecked ? handleCancelAttendance(student, selectedDate) : handleCheckAttendance(student, selectedDate)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isChecked
                                ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-md'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {student.photo_url ? (
                              <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white/50">
                                <Image
                                  src={student.photo_url}
                                  alt={student.name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-2xl ${
                                isChecked ? 'bg-white/20' : 'bg-white'
                              }`}>
                                👨‍🎓
                              </div>
                            )}

                            <div className="flex-1 text-left">
                              <h3 className={`text-sm font-bold ${isChecked ? 'text-white' : 'text-gray-900'}`}>
                                {student.name}
                              </h3>
                              {(student.grade || student.age) && (
                                <p className={`text-xs mt-0.5 ${isChecked ? 'text-white/80' : 'text-gray-500'}`}>
                                  {student.grade || `${student.age}세`}
                                </p>
                              )}
                            </div>

                            {isChecked && (
                              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
