'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';

interface InviteData {
  church_id: string;
  church_name: string;
  role: string;
  expires_at: string;
  created_by_name: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkInvite();
  }, [token]);

  const checkInvite = async () => {
    try {
      // 사용자 인증 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 로그인하지 않은 경우 - 로그인 페이지로 리다이렉트하고 돌아올 때 이 페이지로
        router.push(`/login?redirect=/invite/${token}`);
        return;
      }

      // 초대 토큰 확인
      const { data: inviteToken, error: tokenError } = await supabase
        .from('church_invite_tokens')
        .select(`
          church_id,
          role,
          expires_at,
          max_uses,
          used_count,
          created_by,
          churches (
            name
          )
        `)
        .eq('token', token)
        .single();

      if (tokenError || !inviteToken) {
        setError('유효하지 않은 초대 링크입니다.');
        setLoading(false);
        return;
      }

      // 만료 확인
      if (new Date(inviteToken.expires_at) < new Date()) {
        setError('만료된 초대 링크입니다.');
        setLoading(false);
        return;
      }

      // 사용 횟수 확인
      if (inviteToken.used_count >= inviteToken.max_uses) {
        setError('사용 횟수가 초과된 초대 링크입니다.');
        setLoading(false);
        return;
      }

      // 이미 멤버인지 확인
      const { data: existingMember } = await supabase
        .from('church_members')
        .select('id')
        .eq('church_id', inviteToken.church_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        setError('이미 이 교회의 멤버입니다.');
        setLoading(false);
        return;
      }

      // 초대한 사람 정보 가져오기
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', inviteToken.created_by)
        .single();

      setInviteData({
        church_id: inviteToken.church_id,
        church_name: (inviteToken.churches as any).name,
        role: inviteToken.role,
        expires_at: inviteToken.expires_at,
        created_by_name: creatorProfile?.name || '관리자'
      });

    } catch (error) {
      console.error('초대 확인 실패:', error);
      setError('초대를 확인하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!inviteData) return;

    setAccepting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?redirect=/invite/${token}`);
        return;
      }

      // 1. church_members에 추가
      const { error: memberError } = await supabase
        .from('church_members')
        .insert([
          {
            church_id: inviteData.church_id,
            user_id: user.id,
            role: inviteData.role
          }
        ]);

      if (memberError) throw memberError;

      // 2. 초대 토큰 사용 횟수 증가
      const { data: currentToken } = await supabase
        .from('church_invite_tokens')
        .select('used_count')
        .eq('token', token)
        .single();

      if (currentToken) {
        await supabase
          .from('church_invite_tokens')
          .update({ used_count: currentToken.used_count + 1 })
          .eq('token', token);
      }

      // 3. 교회 페이지로 리다이렉트
      router.push(`/church/${inviteData.church_id}`);

    } catch (error) {
      console.error('초대 수락 실패:', error);
      alert('초대를 수락하는 중 오류가 발생했습니다.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-lg">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">초대를 사용할 수 없습니다</h1>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return <LoadingSpinner />;
  }

  const roleText = inviteData.role === 'admin' ? '관리자' : '멤버';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-lg">
        <div className="text-6xl mb-4">📨</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">교회 초대</h1>
        <p className="text-sm text-gray-600 mb-6">
          {inviteData.created_by_name}님이 초대했습니다
        </p>

        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {inviteData.church_name}
          </h2>
          <p className="text-sm text-gray-600">
            역할: <span className="font-semibold text-blue-600">{roleText}</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            만료: {new Date(inviteData.expires_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={acceptInvite}
            disabled={accepting}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? '초대 수락 중...' : '초대 수락하기'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full rounded-lg border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
