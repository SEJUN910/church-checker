import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const prayerId = request.nextUrl.searchParams.get('prayer_id');
  if (!prayerId) return NextResponse.json({ error: 'prayer_id가 필요합니다' }, { status: 400 });

  const supabase = getClient();
  const { data, error } = await supabase
    .from('public_prayer_comments')
    .select('*')
    .eq('prayer_id', prayerId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { prayer_id, author_name, content } = await request.json();

  if (!prayer_id || !content?.trim()) {
    return NextResponse.json({ error: 'prayer_id와 내용은 필수입니다' }, { status: 400 });
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('public_prayer_comments')
    .insert([{ prayer_id, author_name: author_name?.trim() || '익명', content: content.trim() }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
