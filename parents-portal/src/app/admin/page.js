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

async function signedImageUrl(supabase, bucket, path) {
  if (!bucket || !path) return null;

  if (bucket === "public-photos") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 30);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState([]);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    location.href = "/login";
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      if (!supabase) {
        setIsAdmin(false);
        setPending([]);
        setError("Supabase設定が未設定です（.env を確認してください）");
        return;
      }
      const { profile, user } = await getMyProfile();
      setUser(user);
      const ok = profile?.role === "admin";
      setIsAdmin(ok);
      if (!ok) {
        setPending([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .select(
          "id,created_at,title,body,author_name,is_anonymous,requested_visibility,status,image_bucket,image_path"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const hydrated = await Promise.all(
        (data ?? []).map(async (p) => ({
          ...p,
          previewUrl: await signedImageUrl(supabase, p.image_bucket, p.image_path),
        }))
      );

      setPending(hydrated);
    } catch (err) {
      setError(err?.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveParents(post) {
    setSavingId(post.id);
    setError("");
    try {
      const { error } = await supabase
        .from("posts")
        .update({ status: "approved", visibility: "parents" })
        .eq("id", post.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err?.message ?? "承認に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  async function approvePublic(post) {
    setSavingId(post.id);
    setError("");
    try {
      // public に出す場合は public bucket に複製して URL を一般公開可能にする
      const ext = post.image_path?.split(".")?.pop() || "jpg";
      const toPath = `public/${post.id}/${crypto.randomUUID()}.${ext}`;

      const { data: downloaded, error: dlErr } = await supabase.storage
        .from("parents-photos")
        .download(post.image_path);
      if (dlErr) throw dlErr;

      const { error: upErr } = await supabase.storage
        .from("public-photos")
        .upload(toPath, downloaded, {
          cacheControl: "3600",
          upsert: false,
          contentType: downloaded?.type || undefined,
        });
      if (upErr) throw upErr;

      const { error: updateErr } = await supabase
        .from("posts")
        .update({
          status: "approved",
          visibility: "public",
          image_bucket: "public-photos",
          image_path: toPath,
        })
        .eq("id", post.id);

      if (updateErr) throw updateErr;

      await load();
    } catch (err) {
      setError(err?.message ?? "承認に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  async function reject(post) {
    setSavingId(post.id);
    setError("");
    try {
      // 先にDB削除してから、画像削除（失敗しても次回クリーンアップ可能）
      const { error: delErr } = await supabase.from("posts").delete().eq("id", post.id);
      if (delErr) throw delErr;

      if (post.image_bucket && post.image_path) {
        await supabase.storage.from(post.image_bucket).remove([post.image_path]);
      }

      await load();
    } catch (err) {
      setError(err?.message ?? "却下に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="container">
      <div className="nav">
        <div className="nav-links">
          <a href="/feed">フィード</a>
          <a href="/submit">投稿</a>
          <a href="/admin">承認</a>
          <a href="/login">ログイン</a>
        </div>
        <div className="row">
          {user ? (
            <>
              <span className="muted">{user.email}</span>
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
        <h1>承認（運営）</h1>

        {!supabase ? (
          <p className="muted">
            Supabase設定が未設定です（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
          </p>
        ) : null}

        {loading ? <p>読み込み中...</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        {!loading && !isAdmin ? (
          <div className="card stack">
            <p>このページは運営（admin）のみ利用できます。</p>
          </div>
        ) : null}

        {isAdmin && !loading && !pending.length ? <p>承認待ちはありません</p> : null}

        {pending.map((post) => (
          <article key={post.id} className="card stack">
            <div className="row">
              <strong>{post.title}</strong>
              <span className="muted">{formatDate(post.created_at)}</span>
              <span className="muted">希望: {post.requested_visibility === "public" ? "一般公開" : "保護者限定"}</span>
            </div>

            {post.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.previewUrl}
                alt={post.title}
                className="post-image"
              />
            ) : null}

            <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
            <p className="muted">
              投稿者: {post.is_anonymous ? "匿名" : post.author_name || "（未入力）"}
            </p>

            <div className="row">
              <button
                className="btn"
                type="button"
                onClick={() => approveParents(post)}
                disabled={savingId === post.id}
              >
                承認（保護者限定）
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => approvePublic(post)}
                disabled={savingId === post.id}
              >
                承認（一般公開）
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => reject(post)}
                disabled={savingId === post.id}
              >
                却下（削除）
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
