import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptRRN } from '@/lib/encryption';

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string) {
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', churchId).single();
  if (church?.owner_id === userId) return true;
  const { data: member } = await supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', userId).single();
  return member?.role === 'admin';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const churchId = req.nextUrl.searchParams.get('church_id');
  if (!churchId) return NextResponse.json({ error: 'church_id required' }, { status: 400 });

  // Must be church member or owner
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', churchId).single();
  const { data: membership } = await supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', user.id).single();
  if (church?.owner_id !== user.id && !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query = supabase
    .from('members')
    .select('id, type, name, photo_url, birthdate, memo, created_at')
    .eq('church_id', churchId)
    .order('name');

  const type = req.nextUrl.searchParams.get('type');
  if (type && type !== 'all') query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { church_id, type, name, photo_url, birthdate, rrn, memo } = body;
  if (!church_id || !type || !name) return NextResponse.json({ error: 'church_id, type, name required' }, { status: 400 });

  const admin = await checkAdmin(supabase, user.id, church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const row: Record<string, unknown> = { church_id, type, name, photo_url: photo_url ?? null, birthdate: birthdate ?? null, memo: memo ?? null, created_by: user.id };
  if (rrn) row.rrn_encrypted = encryptRRN(rrn);

  const { data, error } = await supabase.from('members').insert([row]).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
