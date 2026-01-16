"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const router = useRouter();
  const [error, setError] = useState("");
  const missingConfig = !supabase;

  useEffect(() => {
    if (!supabase) return;

    let unsub = null;

    async function run() {
      // createClient(detectSessionInUrl=true) により、このページ到達時に
      // URL内の認証情報を読み取ってセッション化されます。
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.replace("/feed");
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) router.replace("/feed");
      });

      unsub = sub?.subscription;

      // しばらく待ってもセッションができない場合の案内
      setTimeout(async () => {
        const { data: after } = await supabase.auth.getSession();
        if (!after.session) {
          setError(
            "ログインの処理に失敗しました。もう一度ログインリンクを送ってください。"
          );
        }
      }, 2000);
    }

    run();

    return () => {
      unsub?.unsubscribe?.();
    };
  }, [router, supabase]);

  return (
    <div className="container">
      <div className="stack" style={{ marginTop: 16 }}>
        <h1>ログイン処理中...</h1>
        <p className="muted">自動でフィードへ移動します。</p>
        {missingConfig ? (
          <div className="card stack">
            <p className="muted">
              Supabase設定が未設定です（NEXT_PUBLIC_SUPABASE_URL /
              NEXT_PUBLIC_SUPABASE_ANON_KEY）。
            </p>
            <a href="/login">ログインへ戻る</a>
          </div>
        ) : null}
        {error ? (
          <div className="card stack">
            <p className="muted">{error}</p>
            <a href="/login">ログインへ戻る</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
