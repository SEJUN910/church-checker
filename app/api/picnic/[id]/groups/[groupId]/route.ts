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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkAdminForGroup(supabase, user.id, groupId);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { error } = await supabase.from('picnic_groups').update({ name }).eq('id', groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkAdminForGroup(supabase, user.id, groupId);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase.from('picnic_groups').delete().eq('id', groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
