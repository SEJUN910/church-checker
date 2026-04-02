import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string) {
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', churchId).single();
  if (church?.owner_id === userId) return true;
  const { data: m } = await supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', userId).single();
  return m?.role === 'admin';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 로그인 여부 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 비로그인 시 서비스 롤로 읽기 (isAdmin = false, 편집 불가)
  const db = user ? supabase : createAdminClient();

  const { data: picnic, error } = await db.from('picnics').select('*').eq('id', id).single();
  if (error || !picnic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let isAdmin = false;
  if (user) {
    const [{ data: church }, { data: membership }] = await Promise.all([
      db.from('churches').select('owner_id').eq('id', picnic.church_id).single(),
      db.from('church_members').select('role').eq('church_id', picnic.church_id).eq('user_id', user.id).single(),
    ]);
    if (church?.owner_id !== user.id && !membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    isAdmin = church?.owner_id === user.id || membership?.role === 'admin';
  }

  const [{ data: images }, { data: groups }] = await Promise.all([
    db.from('picnic_images').select('id, url, display_order').eq('picnic_id', id).order('display_order'),
    db.from('picnic_groups').select('id, name, display_order').eq('picnic_id', id).order('display_order'),
  ]);

  let groupsWithMembers: unknown[] = [];
  if (groups && groups.length > 0) {
    const groupIds = groups.map((g: { id: string }) => g.id);
    const { data: gms } = await db.from('picnic_group_members').select('group_id, member_id').in('group_id', groupIds);
    const memberIds = [...new Set((gms ?? []).map((gm: { member_id: string }) => gm.member_id))];

    let memberMap: Record<string, unknown> = {};
    if (memberIds.length > 0) {
      const { data: members } = await db.from('members').select('id, name, photo_url, phone, memo, type').in('id', memberIds);
      (members ?? []).forEach((m: { id: string }) => { memberMap[m.id] = m; });
    }

    groupsWithMembers = groups.map((g: { id: string; name: string; display_order: number }) => ({
      ...g,
      members: (gms ?? [])
        .filter((gm: { group_id: string }) => gm.group_id === g.id)
        .map((gm: { member_id: string }) => memberMap[gm.member_id])
        .filter(Boolean),
    }));
  }

  return NextResponse.json({ picnic: { ...picnic, images: images ?? [], groups: groupsWithMembers, isAdmin } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: picnic } = await supabase.from('picnics').select('church_id').eq('id', id).single();
  if (!picnic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await checkAdmin(supabase, user.id, picnic.church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;

  const { error } = await supabase.from('picnics').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: picnic } = await supabase.from('picnics').select('church_id').eq('id', id).single();
  if (!picnic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await checkAdmin(supabase, user.id, picnic.church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { error } = await supabase.from('picnics').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
