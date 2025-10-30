'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  church_id: string
  title: string
  content: string
  created_by: string
  created_at: string
  updated_at: string
}

interface AnnouncementsProps {
  churchId: string
  userId: string | null
  isAdmin: boolean
}

export default function Announcements({ churchId, userId, isAdmin }: AnnouncementsProps) {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    loadAnnouncements()
  }, [churchId])

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error('공지사항 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim() || !userId) return

    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert([
          {
            church_id: churchId,
            title: newTitle,
            content: newContent,
            created_by: userId
          }
        ])
        .select()
        .single()

      if (error) throw error

      setAnnouncements([data, ...announcements])
      setNewTitle('')
      setNewContent('')
      setShowCreateModal(false)
    } catch (error) {
      console.error('공지사항 생성 실패:', error)
      alert('공지사항을 작성하는데 실패했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error

      setAnnouncements(announcements.filter(a => a.id !== id))
    } catch (error) {
      console.error('공지사항 삭제 실패:', error)
      alert('공지사항을 삭제하는데 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div>
      {/* 관리자만 작성 버튼 표시 */}
      {isAdmin && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="mb-4 w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5 text-blue-600 hover:border-blue-400 hover:bg-blue-100 transition-all"
        >
          <div className="text-2xl">+</div>
          <div className="mt-1 font-bold">새 공지사항 작성</div>
        </button>
      )}

      {/* 공지사항 목록 */}
      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="mb-3 text-5xl">📢</div>
          <p className="text-lg font-bold text-gray-900 mb-1">공지사항이 없습니다</p>
          <p className="text-sm text-gray-500">
            {isAdmin ? '새 공지사항을 작성해보세요' : '아직 등록된 공지사항이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => router.push(`/church/${churchId}/announcement/${announcement.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-extrabold text-gray-900 flex-1">
                  {announcement.title}
                </h3>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(announcement.id)
                    }}
                    className="ml-3 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                {announcement.content}
              </p>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <span className="text-xs text-blue-600 font-semibold">
                  자세히 보기 →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 작성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                새 공지사항
              </h2>
              <p className="text-sm text-gray-500">
                제목과 내용을 입력해주세요
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  제목
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="예: 이번 주 일정 안내"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  내용
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  rows={6}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewTitle('')
                    setNewContent('')
                  }}
                  className="flex-1 rounded-full border-2 border-gray-200 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
                >
                  작성하기
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
  )
}
