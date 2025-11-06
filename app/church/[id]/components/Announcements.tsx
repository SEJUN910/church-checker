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
  is_pinned?: boolean
  category?: string
  pinned_at?: string
  image_url?: string | null
  read_by_current_user?: boolean
  read_count?: number
}

interface AnnouncementsProps {
  churchId: string
  userId: string | null
  isAdmin: boolean
  onRefresh?: () => void
}

export default function Announcements({ churchId, userId, isAdmin, onRefresh }: AnnouncementsProps) {
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const loadAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('church_id', churchId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) throw error

        // 각 공지사항의 읽음 상태와 읽은 사람 수 가져오기
        if (userId && data) {
          const announcementsWithReadStatus = await Promise.all(
            data.map(async (announcement) => {
              // 현재 사용자의 읽음 상태 확인
              const { data: readData } = await supabase
                .from('announcement_reads')
                .select('id')
                .eq('announcement_id', announcement.id)
                .eq('user_id', userId)
                .single()

              // 총 읽은 사람 수
              const { count: readCount } = await supabase
                .from('announcement_reads')
                .select('*', { count: 'exact', head: true })
                .eq('announcement_id', announcement.id)

              return {
                ...announcement,
                read_by_current_user: !!readData,
                read_count: readCount || 0
              }
            })
          )
          setAnnouncements(announcementsWithReadStatus)
        } else {
          setAnnouncements(data || [])
        }
      } catch (error) {
        console.error('공지사항 로드 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnnouncements()
  }, [churchId, userId])

  const handleAnnouncementClick = async (announcement: Announcement) => {
    // 읽음 표시
    if (userId && !announcement.read_by_current_user) {
      const supabase = createClient()
      await supabase
        .from('announcement_reads')
        .insert([{
          announcement_id: announcement.id,
          user_id: userId
        }])
    }
    router.push(`/church/${churchId}/announcement/${announcement.id}`)
  }


  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-1 mb-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <p className="text-xs text-gray-500">잠시만 기다려주세요</p>
        <style jsx>{`
          @keyframes wave {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.5;
            }
            30% {
              transform: translateY(-8px);
              opacity: 1;
            }
          }
          .animate-wave {
            animation: wave 1.2s ease-in-out infinite;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div>
      {/* 공지사항 목록 */}
      {announcements.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="mb-2 text-4xl">📢</div>
          <p className="text-sm font-bold text-gray-900 mb-1">공지사항이 없습니다</p>
          <p className="text-xs text-gray-500">
            아직 등록된 공지사항이 없습니다
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer ${
                announcement.is_pinned
                  ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50'
                  : announcement.read_by_current_user
                  ? 'border-gray-200 bg-gray-50 hover:border-blue-300'
                  : 'border-blue-200 bg-white hover:border-blue-400'
              }`}
              onClick={() => handleAnnouncementClick(announcement)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {announcement.is_pinned && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-500 text-white flex items-center gap-1">
                        📌 고정
                      </span>
                    )}
                    {!announcement.read_by_current_user && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex items-center gap-1">
                        NEW
                      </span>
                    )}
                    {announcement.category && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                        {announcement.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(announcement.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    {announcement.read_count !== undefined && announcement.read_count > 0 && (
                      <span className="text-xs text-gray-400">
                        👁️ {announcement.read_count}명 읽음
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm mb-1 ${announcement.read_by_current_user ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                    {announcement.title}
                  </h4>
                  <p className="text-xs text-gray-600 line-clamp-2">{announcement.content}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
