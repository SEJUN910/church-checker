import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string) {
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', churchId).single();
  if (church?.owner_id === userId) return true;
  const { data: m } = await supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', userId).single();
  return m?.role === 'admin';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const churchId = req.nextUrl.searchParams.get('church_id');
  if (!churchId) return NextResponse.json({ error: 'church_id required' }, { status: 400 });

  const [{ data: church }, { data: membership }] = await Promise.all([
    supabase.from('churches').select('owner_id').eq('id', churchId).single(),
    supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', user.id).single(),
  ]);
  if (church?.owner_id !== user.id && !membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('picnics')
    .select('id, title, description, created_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const picnicIds = (data ?? []).map((p: { id: string }) => p.id);
  let thumbnails: Record<string, string> = {};
  let groupCounts: Record<string, number> = {};

  if (picnicIds.length > 0) {
    const [{ data: imgs }, { data: groups }] = await Promise.all([
      supabase.from('picnic_images').select('picnic_id, url').in('picnic_id', picnicIds).order('display_order'),
      supabase.from('picnic_groups').select('picnic_id').in('picnic_id', picnicIds),
    ]);
    (imgs ?? []).forEach((img: { picnic_id: string; url: string }) => {
      if (!thumbnails[img.picnic_id]) thumbnails[img.picnic_id] = img.url;
    });
    (groups ?? []).forEach((g: { picnic_id: string }) => {
      groupCounts[g.picnic_id] = (groupCounts[g.picnic_id] ?? 0) + 1;
    });
  }

  const picnics = (data ?? []).map((p: { id: string; title: string; description: string; created_at: string }) => ({
    ...p,
    thumbnail: thumbnails[p.id] ?? null,
    group_count: groupCounts[p.id] ?? 0,
  }));

  const isAdmin = church?.owner_id === user.id || membership?.role === 'admin';
  return NextResponse.json({ picnics, isAdmin });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { church_id, title } = await req.json();
  if (!church_id || !title) return NextResponse.json({ error: 'church_id, title required' }, { status: 400 });

  const admin = await checkAdmin(supabase, user.id, church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { data, error } = await supabase.from('picnics').insert([{ church_id, title, created_by: user.id }]).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
