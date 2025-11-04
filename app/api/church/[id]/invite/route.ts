import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// 초대 링크 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: churchId } = await params;
    const { role = 'member', maxUses = 1, expiresInDays = 7 } = await request.json();

    const supabase = await createClient();

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    console.log('[POST /api/church/invite] User ID:', user.id, 'Church ID:', churchId);

    // 관리자 권한 확인
    // 1. 교회 owner인지 확인
    const { data: churchData, error: churchError } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    console.log('[POST /api/church/invite] Church data:', churchData, 'error:', churchError);

    let isAdmin = false;

    if (churchData?.owner_id === user.id) {
      // owner는 자동으로 admin 권한
      console.log('[POST /api/church/invite] User is church owner - granting admin access');
      isAdmin = true;
    } else {
      // 2. church_members에서 관리자 권한 확인
      const { data: memberData, error: memberError } = await supabase
        .from('church_members')
        .select('role')
        .eq('church_id', churchId)
        .eq('user_id', user.id)
        .single();

      console.log('[POST /api/church/invite] Member data:', memberData, 'error:', memberError);
      isAdmin = memberData?.role === 'admin';
    }

    console.log('[POST /api/church/invite] Is admin:', isAdmin);

    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 랜덤 토큰 생성 (더 안전한 방법)
    const token = `${churchId.substring(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;

    // 만료 시간 계산
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 초대 토큰 DB에 저장
    const { data: inviteData, error: inviteError } = await supabase
      .from('church_invite_tokens')
      .insert([
        {
          church_id: churchId,
          token,
          role,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          max_uses: maxUses,
          used_count: 0
        }
      ])
      .select()
      .single();

    if (inviteError) throw inviteError;

    // 초대 링크 생성
    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${token}`;

    return NextResponse.json({
      token,
      inviteUrl,
      expiresAt: inviteData.expires_at
    });

  } catch (error) {
    console.error('초대 링크 생성 실패:', error);
    return NextResponse.json(
      { error: '초대 링크 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 활성 초대 링크 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: churchId } = await params;
    const supabase = await createClient();

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    // 1. 교회 owner인지 확인
    const { data: churchData } = await supabase
      .from('churches')
      .select('owner_id')
      .eq('id', churchId)
      .single();

    let isAdmin = false;

    if (churchData?.owner_id === user.id) {
      // owner는 자동으로 admin 권한
      isAdmin = true;
    } else {
      // 2. church_members에서 관리자 권한 확인
      const { data: memberData } = await supabase
        .from('church_members')
        .select('role')
        .eq('church_id', churchId)
        .eq('user_id', user.id)
        .single();

      isAdmin = memberData?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 활성 초대 링크 조회 (만료되지 않고, 사용 횟수가 남은 것)
    const { data: invites, error } = await supabase
      .from('church_invite_tokens')
      .select('*')
      .eq('church_id', churchId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 사용 가능한 초대만 필터링
    const activeInvites = invites?.filter(invite => invite.used_count < invite.max_uses) || [];

    return NextResponse.json({ invites: activeInvites });

  } catch (error) {
    console.error('초대 링크 조회 실패:', error);
    return NextResponse.json(
      { error: '초대 링크 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
