'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { uploadAnnouncementImage, createImagePreview, revokeImagePreview } from '@/lib/supabase/storage';
import toast, { Toaster } from 'react-hot-toast';

interface Announcement {
  id: string;
  church_id: string;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  is_pinned: boolean;
  is_important: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function AnnouncementsPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('사용자');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false,
    is_important: false
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    loadAnnouncements();
  }, [churchId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.name || '사용자');
    } else {
      const tempUserId = localStorage.getItem('tempUserId');
      const tempUserName = localStorage.getItem('tempUserName');
      if (tempUserId && tempUserName) {
        setUserId(tempUserId);
        setUserName(tempUserName);
      }
    }
  };

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('church_id', churchId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    setSelectedImage(file);
    const preview = createImagePreview(file);
    setImagePreview(preview);
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      let imageUrl = null;

      if (editingAnnouncement) {
        // 이미지 업로드 (새 이미지가 선택된 경우)
        if (selectedImage) {
          imageUrl = await uploadAnnouncementImage(churchId, editingAnnouncement.id, selectedImage);
        }

        // 수정
        const updateData: any = {
          title: formData.title,
          content: formData.content,
          is_pinned: formData.is_pinned,
          is_important: formData.is_important
        };

        if (imageUrl) {
          updateData.image_url = imageUrl;
        }

        const { error } = await supabase
          .from('announcements')
          .update(updateData)
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
        toast.success('공지사항이 수정되었습니다.');
      } else {
        // 새로 추가 - 임시 ID로 먼저 생성
        const tempId = crypto.randomUUID();

        // 이미지 업로드 (이미지가 선택된 경우)
        if (selectedImage) {
          imageUrl = await uploadAnnouncementImage(churchId, tempId, selectedImage);
        }

        const { error } = await supabase
          .from('announcements')
          .insert([{
            id: tempId,
            church_id: churchId,
            title: formData.title,
            content: formData.content,
            author_id: userId,
            author_name: userName,
            is_pinned: formData.is_pinned,
            is_important: formData.is_important,
            image_url: imageUrl
          }]);

        if (error) throw error;
        toast.success('공지사항이 작성되었습니다.');
      }

      setFormData({ title: '', content: '', is_pinned: false, is_important: false });
      setEditingAnnouncement(null);
      handleRemoveImage();
      setShowModal(false);
      loadAnnouncements();
    } catch (error) {
      console.error('공지사항 저장 실패:', error);
      toast.error('공지사항 저장에 실패했습니다.');
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned,
      is_important: announcement.is_important
    });
    // 기존 이미지가 있으면 미리보기 설정
    if (announcement.image_url) {
      setImagePreview(announcement.image_url);
    }
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('공지사항이 삭제되었습니다.');
      loadAnnouncements();
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      toast.error('공지사항 삭제에 실패했습니다.');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData({ title: '', content: '', is_pinned: false, is_important: false });
    handleRemoveImage();
  };

  const togglePin = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          is_pinned: !announcement.is_pinned,
          pinned_at: !announcement.is_pinned ? new Date().toISOString() : null
        })
        .eq('id', announcement.id);

      if (error) throw error;
      toast.success(announcement.is_pinned ? '고정이 해제되었습니다.' : '상단에 고정되었습니다.');
      loadAnnouncements();
    } catch (error) {
      console.error('고정 상태 변경 실패:', error);
      toast.error('고정 상태 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />

      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/church/${churchId}`}>
                <button className="rounded-lg p-2 hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Link>
              <h1 className="text-base font-semibold text-gray-900">공지사항</h1>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
            >
              작성
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-md px-5 py-5">
        {announcements.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="mb-3 text-5xl">📢</div>
            <p className="text-sm font-semibold text-gray-900 mb-1">공지사항이 없습니다</p>
            <p className="text-xs text-gray-500 mb-4">
              첫 공지사항을 작성해보세요
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
            >
              공지 작성하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`rounded-xl border bg-white p-4 transition-all ${
                  announcement.is_pinned ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {announcement.is_pinned && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                          📌 고정
                        </span>
                      )}
                      {announcement.is_important && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                          ⚠️ 중요
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {announcement.title}
                    </h3>

                    {/* 이미지 표시 */}
                    {announcement.image_url && (
                      <div className="mb-3 rounded-lg overflow-hidden">
                        <img
                          src={announcement.image_url}
                          alt={announcement.title}
                          className="w-full h-auto max-h-60 object-cover"
                        />
                      </div>
                    )}

                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap line-clamp-3">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{announcement.author_name || '익명'}</span>
                      <span>•</span>
                      <span>
                        {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(announcement);
                      }}
                      className={`rounded-lg p-1.5 transition-colors ${
                        announcement.is_pinned
                          ? 'text-blue-600 hover:bg-blue-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={announcement.is_pinned ? '고정 해제' : '상단 고정'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 작성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {editingAnnouncement ? '공지사항 수정' : '공지사항 작성'}
              </h2>
              <p className="text-sm text-gray-500">
                공지할 내용을 입력해주세요
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  제목
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  placeholder="공지 제목"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  내용
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="공지 내용을 입력하세요"
                  rows={6}
                  required
                />
              </div>

              {/* 이미지 업로드 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  이미지 첨부 (선택)
                </label>
                {imagePreview ? (
                  <div className="relative rounded-xl border-2 border-gray-200 overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 transition-colors bg-gray-50 hover:bg-blue-50">
                    <div className="flex flex-col items-center">
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">이미지를 선택하거나 드래그하세요</p>
                      <p className="text-xs text-gray-400 mt-1">최대 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">📌 상단 고정</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_important}
                    onChange={(e) => setFormData({ ...formData, is_important: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-900">⚠️ 중요 공지</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {editingAnnouncement ? '수정' : '작성'}
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
