"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getMyProfile } from "@/lib/auth";

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString("ja-JP");
  } catch {
    return isoString;
  }
}

export default function FeedPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [sessionUser, setSessionUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    let unsub = null;

    supabase.auth.getUser().then(({ data }) => {
      setSessionUser(data?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
    });

    unsub = data?.subscription;

    return () => {
      unsub?.unsubscribe?.();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        if (!supabase) {
          setError("Supabase設定が未設定です（.env を確認してください）");
          setPosts([]);
          return;
        }
        const { profile, user } = await getMyProfile();
        if (cancelled) return;

        setSessionUser(user);
        setIsAdmin(profile?.role === "admin");

        const { data, error } = await supabase
          .from("posts")
          .select(
            "id,created_at,title,body,author_name,is_anonymous,visibility,status,image_bucket,image_path"
          )
          .eq("status", "approved")
          .in("visibility", ["parents", "public"])
          .order("created_at", { ascending: false });

        if (error) throw error;

        const hydrated = await Promise.all(
          (data ?? []).map(async (post) => {
            if (!post.image_bucket || !post.image_path) return { ...post, imageUrl: null };

            if (post.image_bucket === "public-photos") {
              const { data: pub } = supabase.storage
                .from(post.image_bucket)
                .getPublicUrl(post.image_path);
              return { ...post, imageUrl: pub?.publicUrl ?? null };
            }

            const { data: signed, error: signErr } = await supabase.storage
              .from(post.image_bucket)
              .createSignedUrl(post.image_path, 60 * 30);

            if (signErr) return { ...post, imageUrl: null };
            return { ...post, imageUrl: signed?.signedUrl ?? null };
          })
        );

        if (cancelled) return;
        setPosts(hydrated);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message ?? "読み込みに失敗しました");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <div className="container">
      <div className="nav">
        <div className="nav-links">
          <a href="/feed">フィード</a>
          <a href="/submit">投稿</a>
          {isAdmin ? <a href="/admin">承認</a> : null}
          <a href="/login">ログイン</a>
        </div>
        <div className="row">
          {sessionUser ? (
            <>
              <span className="muted">{sessionUser.email}</span>
              <button className="btn" type="button" onClick={logout}>
                ログアウト
              </button>
            </>
          ) : (
            <span className="muted">未ログイン</span>
          )}
        </div>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <h1>承認済み投稿</h1>
        <p className="muted">保護者限定と一般公開の承認済み投稿を表示します。</p>

        {!supabase ? (
          <p className="muted">
            Supabase設定が未設定です（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
          </p>
        ) : null}

        {loading ? <p>読み込み中...</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        {!loading && !posts.length ? <p>投稿がありません</p> : null}

        {posts.map((post) => (
          <article key={post.id} className="card stack">
            <div className="row">
              <strong>{post.title}</strong>
              <span className="muted">{formatDate(post.created_at)}</span>
              <span className="muted">
                {post.visibility === "public" ? "一般公開" : "保護者限定"}
              </span>
            </div>

            {post.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.imageUrl}
                alt={post.title}
                className="post-image"
              />
            ) : null}

            <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>

            <p className="muted">
              投稿者: {post.is_anonymous ? "匿名" : post.author_name || "（未入力）"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
