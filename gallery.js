import { createClient } from "@supabase/supabase-js";

const statusEl = document.getElementById("gallery-status");
const gridEl = document.getElementById("gallery-grid");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  statusEl.textContent =
    "Supabase設定（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）が未設定です。";
} else {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

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

    // crypto.randomUUID が無い環境向けフォールバック
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

  async function fetchLikeCounts(postIds) {
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

  async function load() {
    statusEl.textContent = "読み込み中...";
    gridEl.innerHTML = "";

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id,created_at,title,body,author_name,is_anonymous,visibility,status,image_bucket,image_path"
      )
      .eq("status", "approved")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      statusEl.textContent = `読み込みに失敗しました: ${error.message}`;
      return;
    }

    if (!data?.length) {
      statusEl.textContent = "表示できる投稿がありません。";
      return;
    }

    statusEl.textContent = "";

    const likeCounts = await fetchLikeCounts((data ?? []).map((p) => p.id));
    const likeToken = getOrCreateLikeToken();

    for (const post of data) {
      const bucket = post.image_bucket || "public-photos";
      const path = post.image_path;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub?.publicUrl;

      const cardUrl = `${location.origin}${location.pathname}#post-${post.id}`;
      const liked = isLiked(post.id);
      const likeCount = likeCounts.get(post.id) ?? 0;

      const card = document.createElement("article");
      card.className = "gallery-card";
      card.id = `post-${post.id}`;

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
          <button class="gallery-action-btn" type="button" data-action="share" data-url="${escapeHtml(cardUrl)}" data-title="${escapeHtml(post.title)}" data-body="${escapeHtml(post.body)}">
            共有
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
          statusEl.textContent = `いいねに失敗しました: ${likeErr.message}`;
          return;
        }

        setLiked(postId);
        const countEl = btn.querySelector("[data-like-count]");
        if (countEl) countEl.textContent = String(newCount ?? 0);
      });

      card.querySelector('[data-action="share"]')?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const shareUrl = btn.getAttribute("data-url");
        const title = btn.getAttribute("data-title") || "";
        const body = btn.getAttribute("data-body") || "";
        if (!shareUrl) return;

        try {
          if (navigator.share) {
            await navigator.share({
              title,
              text: body.slice(0, 80),
              url: shareUrl,
            });
          } else {
            await navigator.clipboard.writeText(shareUrl);
            statusEl.textContent = "共有リンクをコピーしました。";
            setTimeout(() => {
              if (statusEl.textContent === "共有リンクをコピーしました。") statusEl.textContent = "";
            }, 2500);
          }
        } catch {
          // ユーザーがキャンセルした場合などは何もしない
        }
      });

      gridEl.appendChild(card);
    }
  }
  load();
}
