import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 30;

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const sort = request.nextUrl.searchParams.get('sort') || 'latest';
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = getClient();
  const { data, error, count } = await supabase
    .from('public_love_messages')
    .select('*', { count: 'exact' })
    .order(sort === 'likes' ? 'likes_count' : 'created_at', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count });
}

export async function POST(request: NextRequest) {
  const { author_name, content } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
  }

  const supabase = getClient();

  // 10초 내 동일 내용 중복 방지
  const { count } = await supabase
    .from('public_love_messages')
    .select('id', { count: 'exact', head: true })
    .eq('content', content.trim())
    .gte('created_at', new Date(Date.now() - 10_000).toISOString());
  if ((count ?? 0) > 0)
    return NextResponse.json({ error: '이미 등록된 메세지입니다' }, { status: 409 });

  const { data, error } = await supabase
    .from('public_love_messages')
    .insert([{ author_name: author_name?.trim() || 'DK', content: content.trim() }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
