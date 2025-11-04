'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    bio: ''
  });

  useEffect(() => {
    checkUserAndProfile();
  }, []);

  const checkUserAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // 기존 프로필이 있는지 확인
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        // 이미 프로필이 있으면 메인으로
        router.push('/');
        return;
      }

      // 카카오에서 받은 정보가 있으면 미리 채우기
      if (user.user_metadata?.name || user.user_metadata?.full_name) {
        setProfile(prev => ({
          ...prev,
          name: user.user_metadata.name || user.user_metadata.full_name || ''
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('사용자 확인 실패:', error);
      router.push('/login');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile.name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }

    setSaving(true);

    try {
      // profiles 테이블에 저장
      const { error } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            name: profile.name,
            phone: profile.phone || null,
            bio: profile.bio || null,
            updated_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      toast.success('프로필이 설정되었습니다! 🎉');

      // 메인 페이지로 이동
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (error) {
      console.error('프로필 저장 실패:', error);
      toast.error('프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <Toaster position="top-center" />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {/* 헤더 */}
          <div className="mb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">프로필 설정</h1>
            <p className="text-sm text-gray-600">환영합니다! 프로필을 설정해주세요</p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                placeholder="실명 또는 닉네임"
                required
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                전화번호 (선택)
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                placeholder="010-1234-5678"
              />
            </div>

            {/* 소개 */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                소개 (선택)
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none resize-none"
                placeholder="간단한 소개를 입력해주세요"
                rows={3}
              />
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '완료'}
            </button>
          </form>
        </div>

        {/* 이메일 정보 */}
        {user?.email && (
          <p className="mt-4 text-center text-xs text-gray-500">
            로그인 이메일: {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
