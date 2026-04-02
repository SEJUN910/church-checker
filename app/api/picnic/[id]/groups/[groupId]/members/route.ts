import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function checkAdminForGroup(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, groupId: string) {
  const { data: group } = await supabase.from('picnic_groups').select('picnic_id').eq('id', groupId).single();
  if (!group) return false;
  const { data: picnic } = await supabase.from('picnics').select('church_id').eq('id', group.picnic_id).single();
  if (!picnic) return false;
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', picnic.church_id).single();
  if (church?.owner_id === userId) return true;
  const { data: m } = await supabase.from('church_members').select('role').eq('church_id', picnic.church_id).eq('user_id', userId).single();
  return m?.role === 'admin';
}

// POST: add member to group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkAdminForGroup(supabase, user.id, groupId);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { member_ids } = await req.json();
  if (!member_ids?.length) return NextResponse.json({ error: 'member_ids required' }, { status: 400 });

  const rows = member_ids.map((mid: string) => ({ group_id: groupId, member_id: mid }));
  const { error } = await supabase.from('picnic_group_members').upsert(rows, { onConflict: 'group_id,member_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: remove member from group (?member_id=xxx)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkAdminForGroup(supabase, user.id, groupId);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const memberId = req.nextUrl.searchParams.get('member_id');
  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

  const { error } = await supabase.from('picnic_group_members').delete().eq('group_id', groupId).eq('member_id', memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
