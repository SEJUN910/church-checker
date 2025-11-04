'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
  category?: string;
  status?: string;
  student?: {
    name: string;
  };
}

interface Comment {
  id: string;
  prayer_id: string;
  content: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export default function PrayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;
  const prayerId = params.prayerId as string;
  const supabase = createClient();

  const [prayer, setPrayer] = useState<PrayerRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrayer, setEditedPrayer] = useState({
    title: '',
    content: '',
    category: '일반',
    status: '진행중'
  });

  useEffect(() => {
    checkUser();
    loadPrayer();
    loadComments();
  }, [prayerId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    setUserId(user.id);

    // 프로필에서 이름 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    setUserName(profile?.name || user.email?.split('@')[0] || '사용자');
  };

  const loadPrayer = async () => {
    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .select('*')
        .eq('id', prayerId)
        .single();

      if (error) throw error;

      // 학생 정보 로드
      if (data.student_id && !data.is_anonymous) {
        const { data: student } = await supabase
          .from('students')
          .select('name')
          .eq('id', data.student_id)
          .single();

        data.student = student;
      }

      setPrayer(data);
    } catch (error) {
      console.error('기도제목 로드 실패:', error);
      toast.error('기도제목을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('prayer_comments')
        .select('*')
        .eq('prayer_id', prayerId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim() || !userId) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('prayer_comments')
        .insert([{
          prayer_id: prayerId,
          content: newComment,
          created_by: userId,
          created_by_name: userName
        }])
        .select()
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment('');
      toast.success('댓글이 등록되었습니다 💬');
    } catch (error) {
      console.error('댓글 등록 실패:', error);
      toast.error('댓글 등록에 실패했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('prayer_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(comments.filter(c => c.id !== commentId));
      toast.success('댓글이 삭제되었습니다.');
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      toast.error('댓글 삭제에 실패했습니다.');
    }
  };

  // 응답 상태 변경
  const handleToggleAnswered = async () => {
    if (!prayer) return;

    try {
      const newAnsweredStatus = !prayer.is_answered;
      const { error } = await supabase
        .from('prayer_requests')
        .update({
          is_answered: newAnsweredStatus,
          answered_at: newAnsweredStatus ? new Date().toISOString() : null,
        })
        .eq('id', prayerId);

      if (error) throw error;

      setPrayer({
        ...prayer,
        is_answered: newAnsweredStatus,
        answered_at: newAnsweredStatus ? new Date().toISOString() : null,
      });

      toast.success(newAnsweredStatus ? '기도가 응답되었습니다! 🙏✨' : '응답 상태가 취소되었습니다.');
    } catch (error) {
      console.error('응답 상태 변경 실패:', error);
      toast.error('응답 상태 변경에 실패했습니다.');
    }
  };

  // 상태 변경
  const handleStatusChange = async (newStatus: string) => {
    if (!prayer) return;

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .update({ status: newStatus })
        .eq('id', prayerId);

      if (error) throw error;

      setPrayer({ ...prayer, status: newStatus });
      toast.success('상태가 변경되었습니다.');
    } catch (error) {
      console.error('상태 변경 실패:', error);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // 수정 모드 시작
  const startEditing = () => {
    if (!prayer) return;
    setEditedPrayer({
      title: prayer.title,
      content: prayer.content,
      category: prayer.category || '일반',
      status: prayer.status || '진행중'
    });
    setIsEditing(true);
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!prayer) return;

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .update({
          title: editedPrayer.title,
          content: editedPrayer.content,
          category: editedPrayer.category,
          status: editedPrayer.status
        })
        .eq('id', prayerId);

      if (error) throw error;

      setPrayer({
        ...prayer,
        title: editedPrayer.title,
        content: editedPrayer.content,
        category: editedPrayer.category,
        status: editedPrayer.status
      });
      setIsEditing(false);
      toast.success('기도제목이 수정되었습니다 ✏️');
    } catch (error) {
      console.error('기도제목 수정 실패:', error);
      toast.error('기도제목 수정에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0s' }}></div>
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-sm text-gray-600">잠시만 기다려주세요</p>
          <style jsx>{`
            @keyframes wave {
              0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.5;
              }
              30% {
                transform: translateY(-10px);
                opacity: 1;
              }
            }
            .animate-wave {
              animation: wave 1.2s ease-in-out infinite;
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!prayer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 mb-2">기도제목을 찾을 수 없습니다</p>
          <Link href={`/church/${churchId}`}>
            <button className="text-sm text-blue-600 hover:text-blue-700">돌아가기</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold">기도제목</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-20">
        {/* 기도제목 카드 */}
        <div className={`mb-5 rounded-xl border p-5 ${
          prayer.is_answered ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {prayer.is_answered && (
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                ✓ 응답됨
              </span>
            )}
            {prayer.category && (
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {prayer.category}
              </span>
            )}
            {prayer.status && (
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                prayer.status === '응답됨' ? 'bg-green-100 text-green-700' :
                prayer.status === '진행중' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {prayer.status}
              </span>
            )}
            {prayer.is_anonymous ? (
              <span className="text-sm font-bold text-gray-500">익명</span>
            ) : prayer.student ? (
              <span className="text-sm font-bold text-blue-600">{prayer.student.name}</span>
            ) : (
              <span className="text-sm font-bold text-gray-500">작성자</span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(prayer.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <button
              onClick={startEditing}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ✏️ 수정
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">제목</label>
                <input
                  type="text"
                  value={editedPrayer.title}
                  onChange={(e) => setEditedPrayer({ ...editedPrayer, title: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-base font-semibold focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">내용</label>
                <textarea
                  value={editedPrayer.content}
                  onChange={(e) => setEditedPrayer({ ...editedPrayer, content: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-base focus:border-blue-600 focus:outline-none resize-none"
                  rows={6}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-lg border-2 border-gray-300 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-3">{prayer.title}</h1>
              <p className="text-base text-gray-700 whitespace-pre-wrap mb-4">{prayer.content}</p>
            </>
          )}

          {/* 응답 및 상태 변경 버튼 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleToggleAnswered}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                prayer.is_answered
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {prayer.is_answered ? '✓ 응답됨' : '응답 체크'}
            </button>

            <select
              value={prayer.status || '진행중'}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold text-gray-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="진행중">진행중</option>
              <option value="응답됨">응답됨</option>
              <option value="대기중">대기중</option>
            </select>
          </div>

          {prayer.answer_testimony && (
            <div className="mt-4 rounded-lg bg-white p-4 border border-green-200">
              <p className="text-sm font-bold text-green-700 mb-2">✨ 감사 간증</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{prayer.answer_testimony}</p>
              {prayer.answered_at && (
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(prayer.answered_at).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 댓글 섹션 */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            💬 댓글 ({comments.length})
          </h2>

          {/* 댓글 목록 */}
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <p className="text-sm text-gray-500">첫 번째 댓글을 남겨주세요</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">
                          {comment.created_by_name || '익명'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                    {comment.created_by === userId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 댓글 입력 - 하단 고정 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="mx-auto max-w-md">
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="함께 기도하는 마음을 전해주세요..."
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all"
            >
              등록
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
