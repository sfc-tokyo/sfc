import { createClient } from "@supabase/supabase-js";

let supabase;

export function getSupabaseBrowser() {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ビルド時/未設定時でも落とさない（画面側でメッセージ表示）
  if (!url || !anonKey) return null;

  supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabase;
}
