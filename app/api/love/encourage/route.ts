import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: '기도제목 ID가 필요합니다' }, { status: 400 });

  const supabase = getClient();

  const { data, error: readError } = await supabase
    .from('public_prayer_wall')
    .select('encouragement_count')
    .eq('id', id)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const { error } = await supabase
    .from('public_prayer_wall')
    .update({ encouragement_count: (data.encouragement_count || 0) + 1 })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: (data.encouragement_count || 0) + 1 });
}
