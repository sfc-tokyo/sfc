"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) router.replace("/feed");
    });

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage("");
    if (!supabase) {
      setMessage("Supabase設定が未設定です（.env を確認してください）");
      return;
    }
    setSending(true);
    try {
      const emailRedirectTo = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });

      if (error) throw error;
      setMessage("ログイン用リンクをメールで送信しました。メールをご確認ください。");
    } catch (err) {
      setMessage(err?.message ?? "ログインに失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container">
      <div className="stack">
        <h1>保護者ポータル ログイン</h1>
        <p className="muted">
          招待されたメールアドレスのみログインできます（サインアップは無効化推奨）。
        </p>

        {!supabase ? (
          <p className="muted">
            Supabase設定が未設定です（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
          </p>
        ) : null}

        <form className="card stack" onSubmit={onSubmit}>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <div className="row">
            <button className="btn" type="submit" disabled={sending || !supabase}>
              {sending ? "送信中..." : "ログインリンクを送る"}
            </button>
            <a href="/feed">フィードへ</a>
          </div>

          {message ? <p className="muted">{message}</p> : null}
        </form>
      </div>
    </div>
  );
}
