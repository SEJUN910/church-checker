import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptRRN, decryptRRN } from '@/lib/encryption';

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, churchId: string) {
  const { data: church } = await supabase.from('churches').select('owner_id').eq('id', churchId).single();
  if (church?.owner_id === userId) return true;
  const { data: member } = await supabase.from('church_members').select('role').eq('church_id', churchId).eq('user_id', userId).single();
  return member?.role === 'admin';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: row, error } = await supabase.from('members').select('*').eq('id', id).single();
  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await checkAdmin(supabase, user.id, row.church_id);
  const { rrn_encrypted, ...rest } = row;
  const member = { ...rest, rrn: admin && rrn_encrypted ? decryptRRN(rrn_encrypted) : null };
  return NextResponse.json({ member });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabase.from('members').select('church_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await checkAdmin(supabase, user.id, existing.church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.type !== undefined) updates.type = body.type;
  if (body.name !== undefined) updates.name = body.name;
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url;
  if (body.birthdate !== undefined) updates.birthdate = body.birthdate || null;
  if (body.memo !== undefined) updates.memo = body.memo || null;
  if (body.rrn !== undefined) updates.rrn_encrypted = body.rrn ? encryptRRN(body.rrn) : null;

  const { error } = await supabase.from('members').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabase.from('members').select('church_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await checkAdmin(supabase, user.id, existing.church_id);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
