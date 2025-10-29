'use client'

import { useState } from 'react'

interface AttendanceRecord {
  id: string
  student_id: string
  date: string
}

interface Student {
  id: string
  name: string
  type: string
}

interface AttendanceCalendarProps {
  students: Student[]
  attendanceRecords: AttendanceRecord[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
}

export default function AttendanceCalendar({
  students,
  attendanceRecords,
  currentMonth,
  onMonthChange,
}: AttendanceCalendarProps) {
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

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          ← 이전
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={goToday}
            className="px-3 py-1 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            오늘
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          다음 →
        </button>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>교사</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
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

          return (
            <div
              key={date}
              className={`aspect-square border rounded-lg p-2 flex flex-col items-center justify-between ${
                isTodayDate
                  ? 'border-2 border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
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
                    <div className="flex items-center gap-1 bg-blue-100 rounded px-1 py-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-blue-700 font-medium">{stats.teacherCount}</span>
                    </div>
                  )}
                  {stats.studentCount > 0 && (
                    <div className="flex items-center gap-1 bg-green-100 rounded px-1 py-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-green-700 font-medium">{stats.studentCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 통계 요약 */}
      <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">이번 달 교사 출석</div>
          <div className="text-2xl font-bold text-blue-700">
            {attendanceRecords.filter(r => {
              const recordDate = new Date(r.date)
              return (
                recordDate.getFullYear() === year &&
                recordDate.getMonth() === month &&
                students.find(s => s.id === r.student_id)?.type === 'teacher'
              )
            }).length}
            <span className="text-sm font-normal ml-1">회</span>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 mb-1">이번 달 학생 출석</div>
          <div className="text-2xl font-bold text-green-700">
            {attendanceRecords.filter(r => {
              const recordDate = new Date(r.date)
              return (
                recordDate.getFullYear() === year &&
                recordDate.getMonth() === month &&
                students.find(s => s.id === r.student_id)?.type === 'student'
              )
            }).length}
            <span className="text-sm font-normal ml-1">회</span>
          </div>
        </div>
      </div>
    </div>
  )
}
