'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import toast, { Toaster } from 'react-hot-toast';

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    name: string;
    phone: string | null;
  };
}

export default function AdminManagementPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [churchName, setChurchName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteExpireDays, setInviteExpireDays] = useState(7);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  useEffect(() => {
    checkPermission();
    loadData();
  }, [churchId]);

  const checkPermission = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. 교회 owner인지 확인
    const { data: churchData } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    if (churchData?.owner_id === user.id) {
      // owner는 자동으로 admin 권한
      setIsAdmin(true);

      // church_members에 없으면 추가
      const { data: memberData } = await supabase
        .from('church_members')
        .select('id')
        .eq('church_id', churchId)
        .eq('user_id', user.id)
        .single();

      if (!memberData) {
        await supabase
          .from('church_members')
          .insert([{
            church_id: churchId,
            user_id: user.id,
            role: 'admin'
          }]);
      }
      return;
    }

    // 2. church_members에서 관리자 권한 확인
    const { data: memberData } = await supabase
      .from('church_members')
      .select('role')
      .eq('church_id', churchId)
      .eq('user_id', user.id)
      .single();

    if (!memberData || memberData.role !== 'admin') {
      alert('관리자 권한이 필요합니다.');
      router.push(`/church/${churchId}`);
      return;
    }

    setIsAdmin(true);
  };

  const loadData = async () => {
    try {
      // 교회 정보
      const { data: church } = await supabase
        .from('churches')
        .select('name, owner_id')
        .eq('id', churchId)
        .single();

      if (church) {
        setChurchName(church.name);
        setOwnerId(church.owner_id);
      }

      // 멤버 목록
      const { data: membersData, error: membersError } = await supabase
        .from('church_members')
        .select(`
          id,
          user_id,
          role,
          joined_at
        `)
        .eq('church_id', churchId)
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;

      // 각 멤버의 프로필 정보 가져오기
      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, phone')
            .eq('id', member.user_id)
            .single();

          return {
            ...member,
            profiles: profile
          };
        })
      );

      setMembers(membersWithProfiles || []);

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = async () => {
    try {
      const response = await fetch(`/api/church/${churchId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: inviteRole,
          maxUses: 10, // 최대 10명까지 사용 가능
          expiresInDays: inviteExpireDays
        })
      });

      if (!response.ok) throw new Error('초대 링크 생성 실패');

      const data = await response.json();
      setGeneratedInviteUrl(data.inviteUrl);
      toast.success('초대 링크가 생성되었습니다!');
    } catch (error) {
      console.error('초대 링크 생성 실패:', error);
      toast.error('초대 링크 생성에 실패했습니다.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('복사되었습니다!');
  };

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const { error } = await supabase
        .from('church_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('역할이 변경되었습니다.');
      loadData();
    } catch (error) {
      console.error('역할 변경 실패:', error);
      toast.error('역할 변경에 실패했습니다.');
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 교회에서 제거하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('church_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('멤버가 제거되었습니다.');
      loadData();
    } catch (error) {
      console.error('멤버 제거 실패:', error);
      toast.error('멤버 제거에 실패했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/church/${churchId}`}>
              <button className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">관리자 관리</h1>
              <p className="text-xs text-gray-500">{churchName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 py-5">
        {/* 초대 링크 생성 섹션 */}
        <div className="mb-6 bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-3">새 멤버 초대</h2>

          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">역할</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteRole('member')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    inviteRole === 'member'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  멤버
                </button>
                <button
                  onClick={() => setInviteRole('admin')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    inviteRole === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  관리자
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">유효 기간</label>
              <select
                value={inviteExpireDays}
                onChange={(e) => setInviteExpireDays(Number(e.target.value))}
                className="w-full py-2 px-3 rounded-lg border-2 border-gray-200 text-sm font-medium focus:border-blue-600 focus:outline-none"
              >
                <option value={1}>1일</option>
                <option value={3}>3일</option>
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setGeneratedInviteUrl('');
              generateInviteLink();
            }}
            className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
          >
            초대 링크 생성
          </button>

          {generatedInviteUrl && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-semibold text-green-800 mb-2">초대 링크가 생성되었습니다!</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedInviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs bg-white border border-green-300 rounded-lg"
                />
                <button
                  onClick={() => copyToClipboard(generatedInviteUrl)}
                  className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                >
                  복사
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 멤버 목록 */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            멤버 목록 <span className="text-sm text-gray-500">({members.length}명)</span>
          </h2>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{(member.profiles as any)?.name || '이름 없음'}</p>
                      {member.user_id === ownerId && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-white">
                          방장
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        member.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {member.role === 'admin' ? '관리자' : '멤버'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      가입: {new Date(member.joined_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  {member.user_id !== ownerId && (
                    <div className="flex gap-1">
                      {member.role === 'member' ? (
                        <button
                          onClick={() => updateMemberRole(member.id, 'admin')}
                          className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-bold rounded hover:bg-orange-200 transition-colors"
                        >
                          관리자로
                        </button>
                      ) : (
                        <button
                          onClick={() => updateMemberRole(member.id, 'member')}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-colors"
                        >
                          멤버로
                        </button>
                      )}
                      <button
                        onClick={() => removeMember(member.id, (member.profiles as any)?.name)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded hover:bg-red-200 transition-colors"
                      >
                        제거
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
