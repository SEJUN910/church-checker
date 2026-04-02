import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAdminContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, picnicId: string) {
  const { data: picnic } = await supabase.from('picnics').select('church_id').eq('id', picnicId).single();
  if (!picnic) return null;
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', picnic.church_id).single();
  if (church?.owner_id === userId) return picnic;
  const { data: m } = await supabase.from('church_members').select('role').eq('church_id', picnic.church_id).eq('user_id', userId).single();
  if (m?.role === 'admin') return picnic;
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(supabase, user.id, id);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data: existing } = await supabase.from('picnic_groups').select('id').eq('picnic_id', id).order('display_order', { ascending: false }).limit(1).single();
  const display_order = existing ? 1 : 0;

  const { data, error } = await supabase.from('picnic_groups').insert([{ picnic_id: id, name, display_order }]).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
