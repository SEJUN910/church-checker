'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';

interface Announcement {
  id: string;
  church_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  announcement_id: string;
  church_id: string;
  content: string;
  created_by: string;
  author_name: string;
  author_type: 'student' | 'teacher';
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  name: string;
  type: 'student' | 'teacher';
}

interface Church {
  id: string;
  name: string;
}

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;
  const announcementId = params.announcementId as string;

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState<Student | null>(null);

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    loadData();
  }, [churchId, announcementId]);

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

    // 관리자 권한 확인
    const { data: churchData } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    if (churchData?.owner_id === currentUserId) {
      setIsAdmin(true);
    } else {
      const { data: memberData } = await supabase
        .from('church_members')
        .select('role')
        .eq('church_id', churchId)
        .eq('user_id', currentUserId)
        .single();

      setIsAdmin(memberData?.role === 'admin' || memberData?.role === 'owner');
    }

    // 현재 사용자의 학생/교사 정보 가져오기
    const { data: studentData } = await supabase
      .from('students')
      .select('id, name, type')
      .eq('church_id', churchId)
      .eq('registered_by', currentUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (studentData) {
      setCurrentUserInfo(studentData);
    }
  };

  const loadData = async () => {
    try {
      // 교회 정보 로드
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('id, name')
        .eq('id', churchId)
        .single();

      if (churchError) throw churchError;
      setChurch(churchData);

      // 공지사항 로드
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', announcementId)
        .single();

      if (announcementError) throw announcementError;
      setAnnouncement(announcementData);

      // 댓글 로드
      const { data: commentsData, error: commentsError } = await supabase
        .from('announcement_comments')
        .select('*')
        .eq('announcement_id', announcementId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userId || !isAdmin || !currentUserInfo) return;

    try {
      const { data, error } = await supabase
        .from('announcement_comments')
        .insert([
          {
            announcement_id: announcementId,
            church_id: churchId,
            content: newComment,
            created_by: userId,
            author_name: currentUserInfo.name,
            author_type: currentUserInfo.type
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment('');
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      alert('댓글을 작성하는데 실패했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('announcement_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(comments.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글을 삭제하는데 실패했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!announcement || !church) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-base font-bold text-gray-900 mb-1">공지사항을 찾을 수 없습니다</p>
          <p className="text-xs text-gray-500">잘못된 접근이거나 삭제된 공지사항입니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 상단 투명 바 - 뒤로가기 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3">
          <Link
            href={`/church/${churchId}`}
            className="inline-flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold">{church.name}</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-20">
        {/* 공지사항 본문 */}
        <div className="mb-6 rounded-2xl bg-white border border-gray-200 p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-3">
              {announcement.title}
            </h1>
            <p className="text-xs text-gray-400">
              {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
            {announcement.content}
          </p>
        </div>

        {/* 댓글 섹션 */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            댓글 {comments.length}개
          </h2>

          {/* 댓글 목록 */}
          {comments.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center mb-4">
              <p className="text-sm text-gray-500">첫 댓글을 작성해보세요</p>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {comment.author_name}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        comment.author_type === 'teacher'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {comment.author_type === 'teacher' ? '교사' : '학생'}
                      </span>
                    </div>
                    {(isAdmin || comment.created_by === userId) && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                    {comment.content}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 댓글 작성 (관리자만) */}
          {isAdmin ? (
            <form onSubmit={handleAddComment} className="rounded-2xl border border-gray-200 bg-white p-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none mb-3"
                placeholder="댓글을 입력하세요..."
                rows={3}
                required
              />
              <button
                type="submit"
                className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)]"
              >
                댓글 작성
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">
                관리자만 댓글을 작성할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
