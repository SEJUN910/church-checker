import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_PASSWORD = '7332';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function checkPassword(request: NextRequest): boolean {
  return request.headers.get('x-admin-password') === ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!checkPassword(request)) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 });
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('public_prayer_wall')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!checkPassword(request)) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, author_name, category } = body;

  if (!title || !content) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다' }, { status: 400 });
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('public_prayer_wall')
    .insert([{ title, content, author_name: author_name || '익명', category: category || '일반' }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
