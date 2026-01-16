import { createClient } from "@supabase/supabase-js";

const parentsAuthEl = document.getElementById("parents-auth");
const parentsEmailEl = document.getElementById("parents-email");
const parentsSendEl = document.getElementById("parents-send");
const parentsAuthMsgEl = document.getElementById("parents-auth-msg");
const parentsUserEl = document.getElementById("parents-user");
const parentsUserEmailEl = document.getElementById("parents-user-email");
const parentsLogoutEl = document.getElementById("parents-logout");
const parentsStatusEl = document.getElementById("parents-status");
const parentsGridEl = document.getElementById("parents-grid");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getAuthStorageKeyFromSupabaseUrl(url) {
  try {
    const host = new URL(url).host;
    const ref = host.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

function isDebugEnabled() {
  try {
    return new URL(location.href).searchParams.get("debug") === "1";
  } catch {
    return false;
  }
}

function getCanonicalParentsUrl() {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return new URL(`${baseUrl}parents.html`, location.origin).toString();
}

function isAbortError(err) {
  if (!err) return false;
  if (err?.name === "AbortError") return true;
  const msg = String(err?.message ?? "");
  return msg.includes("signal is aborted") || msg.includes("The user aborted");
}

const AUTH_BACKUP_KEY = "sfc_auth_session_backup";

function backupSession(session) {
  try {
    if (!session?.access_token || !session?.refresh_token) return;
    const payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      backed_up_at: Date.now(),
    };
    localStorage.setItem(AUTH_BACKUP_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

function clearSessionBackup() {
  try {
    localStorage.removeItem(AUTH_BACKUP_KEY);
  } catch {
    // no-op
  }
}

function readSessionBackup() {
  try {
    const raw = localStorage.getItem(AUTH_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function withAbortRetry(fn, { retries = 2, delaysMs = [180, 450] } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isAbortError(err) || attempt === retries) throw err;
      const wait = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 250;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const escapeHtml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("ja-JP");
  } catch {
    return "";
  }
};

function getOrCreateLikeToken() {
  const key = "sfc_like_token";
  let token = localStorage.getItem(key);
  if (token) return token;

  const rnd = () => Math.random().toString(16).slice(2);
  token = (crypto?.randomUUID?.() ?? `${rnd()}${rnd()}${rnd()}`);
  localStorage.setItem(key, token);
  return token;
}

function isLiked(postId) {
  return localStorage.getItem(`sfc_liked_${postId}`) === "1";
}

function setLiked(postId) {
  localStorage.setItem(`sfc_liked_${postId}`, "1");
}

async function fetchLikeCounts(supabase, postIds) {
  if (!postIds.length) return new Map();
  const { data, error } = await supabase.rpc("get_like_counts", {
    post_ids: postIds,
  });
  if (error) return new Map();
  const map = new Map();
  for (const row of data ?? []) {
    map.set(row.post_id, Number(row.like_count ?? 0));
  }
  return map;
}

if (!supabaseUrl || !supabaseAnonKey) {
  parentsStatusEl.textContent =
    "Supabase設定（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）が未設定です。";
} else {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Supabase内部のfetchがナビゲーション等で中断されたとき、未捕捉Promise拒否としてConsoleに出ることがある
  // Abort系だけ握りつぶして、ログインUIが壊れないようにする（debug=1 のときはメッセージに残す）
  window.addEventListener("unhandledrejection", (e) => {
    try {
      if (!isAbortError(e.reason)) return;
      e.preventDefault();
      if (isDebugEnabled()) {
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent || "debug: unhandled AbortError suppressed";
      }
    } catch {
      // no-op
    }
  });

  const authStorageKey = getAuthStorageKeyFromSupabaseUrl(supabaseUrl);
  let refreshPromise = null;
  let refreshQueued = false;

  async function tryRestoreSessionFromBackup() {
    const backup = readSessionBackup();
    if (!backup) return null;

    try {
      const { error } = await withAbortRetry(() =>
        supabase.auth.setSession({
          access_token: backup.access_token,
          refresh_token: backup.refresh_token,
        })
      );
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;
      if (session) backupSession(session);
      return session;
    } catch (err) {
      // バックアップが古い/無効なら消して素直にログインし直してもらう
      if (!isAbortError(err)) clearSessionBackup();
      return null;
    }
  }

  async function getSessionWithRetry() {
    const attempt = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        return data?.session ?? null;
      } catch (err) {
        // ナビゲーション/リロード/HMR等でfetchが中断されるとAbortErrorになりうる
        if (isAbortError(err)) return null;
        throw err;
      }
    };

    let session = await attempt();
    if (session) return session;

    // ブラウザによっては復元が遅れることがあるので、短いリトライを入れる
    await new Promise((r) => setTimeout(r, 80));
    session = await attempt();
    if (session) return session;

    await new Promise((r) => setTimeout(r, 180));
    session = await attempt();
    if (session) return session;

    // Supabaseの保存セッションが読めない場合のフォールバック
    return await tryRestoreSessionFromBackup();
  }

  async function refreshAll(reason) {
    if (refreshPromise) {
      refreshQueued = true;
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        do {
          refreshQueued = false;
          await renderAuthUI();
          await loadParents();
        } while (refreshQueued);
      } catch (err) {
        if (err?.name === "AbortError" || String(err?.message || "").includes("signal is aborted")) {
          if (isDebugEnabled()) {
            parentsAuthMsgEl.textContent =
              parentsAuthMsgEl.textContent || `debug: refresh aborted (${reason || ""})`;
          }
          return;
        }
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent ||
          `画面更新中にエラーが発生しました: ${err?.message ?? String(err)}`;
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  async function handleAuthCallbackIfNeeded() {
    // Magic Link/OTP で戻ってきたとき、URLのcode/token_hashからセッションを確立
    const url = new URL(location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") || "magiclink";

    // Supabaseの設定次第では、トークンがハッシュ(#)に入る
    const hashParams = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const errorCode =
      hashParams.get("error_code") || url.searchParams.get("error_code");
    const hashError =
      hashParams.get("error_description") ||
      url.searchParams.get("error_description") ||
      hashParams.get("error") ||
      url.searchParams.get("error");

    if (!code && !tokenHash && !accessToken && !hashError) return;

    parentsAuthMsgEl.textContent = "ログイン処理中...";

    try {
      if (errorCode === "otp_expired") {
        throw new Error(
          "ログインリンクの有効期限が切れました。もう一度「ログインリンクを送る」を押して、届いた最新メールのリンクを開いてください。"
        );
      }
      if (hashError) {
        throw new Error(hashError);
      }

      if (code) {
        const { error } = await withAbortRetry(() => supabase.auth.exchangeCodeForSession(code));
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await withAbortRetry(() =>
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        );
        if (error) throw error;
      } else {
        const { error } = await withAbortRetry(() =>
          supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          })
        );
        if (error) throw error;
      }

      const session = await getSessionWithRetry();
      if (!session) {
        throw new Error(
          "セッションが作成できませんでした。メールのリンクを“同じブラウザ/同じ端末”で開いてください。"
        );
      }

      backupSession(session);

      // code/token_hash を消してURLを綺麗にする
      url.searchParams.delete("code");
      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.hash = "";
      history.replaceState(null, "", url.toString());

      parentsAuthMsgEl.textContent = "ログインしました。";
    } catch (err) {
      parentsAuthMsgEl.textContent =
        err?.message ?? "ログイン処理に失敗しました（リンクをもう一度開いてください）。";
    }
  }

  async function renderAuthUI() {
    const session = await getSessionWithRetry();

    if (session) backupSession(session);

    if (session?.user) {
      parentsAuthEl.hidden = true;
      parentsUserEl.hidden = false;
      parentsUserEmailEl.textContent = session.user.email ?? "ログイン中";
    } else {
      parentsUserEl.hidden = true;
      parentsAuthEl.hidden = false;
      parentsUserEmailEl.textContent = "";
    }
  }

  async function loadParents() {
    parentsStatusEl.textContent = "";
    parentsGridEl.innerHTML = "";

    const session = await getSessionWithRetry();
    if (!session) {
      parentsStatusEl.textContent = "保護者限定を見るにはログインが必要です。";

      if (isDebugEnabled()) {
        const hasStored =
          authStorageKey && typeof localStorage !== "undefined"
            ? Boolean(localStorage.getItem(authStorageKey))
            : false;
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent ||
          `debug: session=null / storageKey=${authStorageKey ?? "(unknown)"} / stored=${hasStored ? "yes" : "no"}`;
      }
      return;
    }

    backupSession(session);

    parentsStatusEl.textContent = "読み込み中...";

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id,created_at,title,body,author_name,is_anonymous,visibility,status,image_bucket,image_path"
      )
      .eq("status", "approved")
      .eq("visibility", "parents")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      parentsStatusEl.textContent = `読み込みに失敗しました: ${error.message}`;
      return;
    }

    if (!data?.length) {
      parentsStatusEl.textContent = "表示できる投稿がありません。";
      return;
    }

    parentsStatusEl.textContent = "";

    const likeToken = getOrCreateLikeToken();
    const likeCounts = await fetchLikeCounts(
      supabase,
      data.map((p) => p.id)
    );

    for (const post of data) {
      const bucket = post.image_bucket;
      const path = post.image_path;

      let url = null;
      if (bucket === "public-photos") {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        url = pub?.publicUrl ?? null;
      } else {
        const { data: signed, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 30);
        if (!signErr) url = signed?.signedUrl ?? null;
      }

      const card = document.createElement("article");
      card.className = "gallery-card";
      card.id = `post-${post.id}`;

      const liked = isLiked(post.id);
      const likeCount = likeCounts.get(post.id) ?? 0;

      card.innerHTML = `
        <div class="gallery-card__meta">
          <span class="gallery-card__title">${escapeHtml(post.title)}</span>
          <span class="gallery-card__date">${escapeHtml(formatDate(post.created_at))}</span>
        </div>
        ${url ? `<img class="gallery-card__img" src="${escapeHtml(url)}" alt="${escapeHtml(post.title)}">` : ""}
        <p class="gallery-card__body">${escapeHtml(post.body)}</p>
        <p class="gallery-card__by">投稿者: ${post.is_anonymous ? "匿名" : escapeHtml(post.author_name || "（未入力）")}</p>
        <div class="gallery-actions">
          <button class="gallery-action-btn" type="button" data-action="like" data-post-id="${escapeHtml(post.id)}" ${liked ? "disabled" : ""}>
            いいね <span data-like-count>${escapeHtml(likeCount)}</span>
          </button>
        </div>
      `;

      card.querySelector('[data-action="like"]')?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const postId = btn.getAttribute("data-post-id");
        if (!postId) return;

        btn.disabled = true;
        const { data: newCount, error: likeErr } = await supabase.rpc("like_post", {
          p_post_id: postId,
          p_user_token: likeToken,
        });

        if (likeErr) {
          btn.disabled = false;
          parentsStatusEl.textContent = `いいねに失敗しました: ${likeErr.message}`;
          return;
        }

        setLiked(postId);
        const countEl = btn.querySelector("[data-like-count]");
        if (countEl) countEl.textContent = String(newCount ?? 0);
      });

      parentsGridEl.appendChild(card);
    }
  }

  parentsSendEl.addEventListener("click", async () => {
    parentsAuthMsgEl.textContent = "";
    const email = parentsEmailEl.value?.trim();
    if (!email) {
      parentsAuthMsgEl.textContent = "メールアドレスを入力してください。";
      return;
    }

    // URLの開き方が /parents.html と /sfc/parents.html で混ざっても安定するように、常に正規URLへ
    const emailRedirectTo = getCanonicalParentsUrl();

    parentsSendEl.disabled = true;
    let cooldownMs = 0;
    try {
      const { error } = await withAbortRetry(() =>
        supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo },
        })
      );
      if (error) throw error;
      parentsAuthMsgEl.textContent =
        "ログインリンクを送信しました。メールのリンクをこの端末で開いてください。";
    } catch (err) {
      const msg = err?.message ?? "ログインリンク送信に失敗しました。";
      const hintLines = [];

      // Supabaseは短時間の連続送信を制限する
      const m = msg.match(/after\s+(\d+)\s+seconds?/i);
      const sec = m ? Number(m[1]) : 0;
      if (sec > 0) {
        cooldownMs = (sec + 1) * 1000;
      }

      // よくある原因のヒントを追加
      if (location.protocol === "file:") {
        hintLines.push(
          "- `file://` で開いています。`npm run dev` かデプロイURLで開いてください。"
        );
      }
      hintLines.push(`- 現在のURL: ${location.href}`);
      hintLines.push(`- Redirect URL（許可すべき）: ${emailRedirectTo}`);

      if (/redirect/i.test(msg) || /not allowed/i.test(msg)) {
        parentsAuthMsgEl.textContent = `${msg}\n\nSupabaseの Authentication → URL Configuration（Redirect URLs）に次を追加してください: ${emailRedirectTo}`;
      } else if (cooldownMs) {
        parentsAuthMsgEl.textContent =
          `短時間に連続で送信できません。${Math.ceil(cooldownMs / 1000)}秒待ってからもう一度お試しください。`;
      } else {
        parentsAuthMsgEl.textContent = [msg, "", ...hintLines].join("\n");
      }
    } finally {
      if (cooldownMs) {
        setTimeout(() => {
          parentsSendEl.disabled = false;
        }, cooldownMs);
      } else {
        parentsSendEl.disabled = false;
      }
    }
  });

  parentsLogoutEl.addEventListener("click", async () => {
    await supabase.auth.signOut();
    clearSessionBackup();
    await renderAuthUI();
    await loadParents();
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      if (isDebugEnabled()) {
        const hasStored =
          authStorageKey && typeof localStorage !== "undefined"
            ? Boolean(localStorage.getItem(authStorageKey))
            : false;
        const email = session?.user?.email ?? "(no-user)";
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent ||
          `debug: event=${event} / stored=${hasStored ? "yes" : "no"} / user=${email}`;
      }

      if (event === "TOKEN_REFRESH_FAILED") {
        parentsAuthMsgEl.textContent =
          "ログインの維持に失敗しました（トークン更新に失敗）。広告ブロッカー/コンテンツブロッカー/追跡防止が有効だと起きやすいので、一度OFFにして再ログインしてください。";
      }
      if (event === "SIGNED_OUT") {
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent ||
          "ログイン状態が解除されました。長時間経過後は再ログインが必要な場合があります。";

        clearSessionBackup();
      }

      await refreshAll(`auth:${event}`);
    } catch (err) {
      // supabase側はこのPromiseを待たないので、必ず例外を回収して未捕捉拒否を防ぐ
      if (isDebugEnabled()) {
        parentsAuthMsgEl.textContent =
          parentsAuthMsgEl.textContent ||
          `debug: onAuthStateChange error=${err?.message ?? String(err)}`;
      }
    }
  });

  (async () => {
    try {
      await handleAuthCallbackIfNeeded();
      await refreshAll("init");
    } catch (err) {
      parentsAuthMsgEl.textContent =
        parentsAuthMsgEl.textContent ||
        `初期化に失敗しました: ${err?.message ?? String(err)}`;
    }
  })();
}
