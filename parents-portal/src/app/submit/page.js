"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getMyProfile } from "@/lib/auth";

function getFileExt(fileName) {
  const idx = fileName.lastIndexOf(".");
  if (idx === -1) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export default function SubmitPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [requestedVisibility, setRequestedVisibility] = useState("parents");
  const [photo, setPhoto] = useState(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const { profile, user } = await getMyProfile();
      if (cancelled) return;
      setUser(user);
      setIsAdmin(profile?.role === "admin");
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    location.href = "/login";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase設定が未設定です（.env を確認してください）");
      return;
    }

    if (!user) {
      setMessage("投稿にはログインが必要です");
      return;
    }

    if (!photo) {
      setMessage("写真を選択してください");
      return;
    }

    setSaving(true);
    try {
      const ext = getFileExt(photo.name) || "jpg";
      const uuid = crypto.randomUUID();
      const imagePath = `uploads/${user.id}/${uuid}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("parents-photos")
        .upload(imagePath, photo, {
          cacheControl: "3600",
          upsert: false,
          contentType: photo.type || undefined,
        });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("posts").insert({
        title,
        body,
        author_name: authorName || null,
        is_anonymous: isAnonymous,
        requested_visibility: requestedVisibility,
        status: "pending",
        image_bucket: "parents-photos",
        image_path: imagePath,
        created_by: user.id,
      });

      if (insertErr) throw insertErr;

      setMessage(
        "投稿しました（承認待ち）。運営が承認するとフィードに表示されます。"
      );
      setTitle("");
      setBody("");
      setAuthorName("");
      setIsAnonymous(false);
      setRequestedVisibility("parents");
      setPhoto(null);
    } catch (err) {
      setMessage(err?.message ?? "投稿に失敗しました");
    } finally {
      setSaving(false);
    }
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
        <h1>写真投稿（承認制）</h1>
                {!supabase ? (
                  <p className="muted">
                    Supabase設定が未設定です（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
                  </p>
                ) : null}
        <p className="muted">
          投稿は運営が承認してから公開されます。個人情報や顔写真の扱いに注意してください。
        </p>

        {loading ? <p>読み込み中...</p> : null}

        {!loading && !user ? (
          <div className="card stack">
            <p>投稿するにはログインが必要です。</p>
            <a href="/login">ログインへ</a>
          </div>
        ) : null}

        {user ? (
          <form className="card stack" onSubmit={onSubmit}>
            <label className="field">
              <span>タイトル</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>本文</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                required
              />
            </label>

            <label className="field">
              <span>表示名（実名など）</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="（匿名の場合は空でOK）"
              />
            </label>

            <div className="row">
              <label className="row">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span>匿名で表示する</span>
              </label>
            </div>

            <label className="field">
              <span>公開希望</span>
              <select
                value={requestedVisibility}
                onChange={(e) => setRequestedVisibility(e.target.value)}
              >
                <option value="parents">保護者限定</option>
                <option value="public">一般公開</option>
              </select>
            </label>

            <label className="field">
              <span>写真</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                required
              />
            </label>

            <div className="row">
              <button className="btn" type="submit" disabled={saving || !supabase}>
                {saving ? "送信中..." : "投稿する"}
              </button>
              <a href="/feed">キャンセル</a>
            </div>

            {message ? (
              <div className="stack">
                <p className="muted">{message}</p>
                <a href="/feed">フィードへ</a>
                {isAdmin ? <a href="/admin">承認ページへ</a> : null}
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
