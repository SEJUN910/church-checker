import { createClient } from '@supabase/supabase-js';
import CheerClient from './CheerClient';

interface Message {
  id: string;
  author_name: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function CheerPage() {
  let initialLatest: Message[] = [];
  let initialBest: Message[]   = [];
  let initialTotal             = 0;

  try {
    const supabase = getSupabase();
    const [r1, r2] = await Promise.all([
      supabase
        .from('public_love_messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 39),
      supabase
        .from('public_love_messages')
        .select('*')
        .order('likes_count', { ascending: false })
        .range(0, 2),
    ]);

    initialLatest = (r1.data as Message[]) || [];
    initialBest   = (r2.data as Message[]) || [];
    initialTotal  = r1.count || 0;
  } catch {
    // SSR 실패 시 클라이언트 폴링으로 폴백
  }

  return (
    <CheerClient
      initialLatest={initialLatest}
      initialBest={initialBest}
      initialTotal={initialTotal}
    />
  );
}
