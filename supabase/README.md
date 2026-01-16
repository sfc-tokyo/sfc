# Supabase セットアップ（保護者ポータル/公開ギャラリー）

このリポジトリは公開サイト（Vite）とは別に、`parents-portal/` の保護者ポータル（Next.js）と、公開側の写真ギャラリー（Vite）が Supabase を参照します。

## 1) Supabase プロジェクト作成
- Supabase で新規プロジェクトを作成

## 2) Auth 設定（招待制）
- Auth → Providers → Email を有効化（Magic Link/OTP）
- Auth → Settings で **Disable signups（サインアップ無効）** をON
- Auth → Users から保護者/運営を **Invite**（招待）

### Auth URL 設定（重要）
Magic Link/OTP の遷移先を正しくするため、以下を設定します。

- Auth → URL Configuration
  - **Site URL**: 保護者ポータルの本番URL（例: `https://parents.example.com`）
  - **Redirect URLs**: 少なくとも以下を追加
    - 本番: `https://parents.example.com/*`
    - 開発: `http://localhost:3000/*`

## 3) DB / RLS / Storage 設定
- SQL Editor で `schema.sql` を実行
- Storage で以下のバケットを作成（名前を一致させる）
  - `parents-photos`（public: OFF）
  - `public-photos`（public: ON）

※ バケット作成後に `schema.sql` を実行してもOKですが、Storage policies はバケット名に依存するため **名前は必ず一致** させてください。

## 4) 運営（admin）設定
招待した運営2名のメールアドレスを `admin_seed.sql` に入れて実行します（`schema.sql` 実行後）。

追加で管理者を増やす場合は `add_admin.sql` を使い、対象メールアドレスを差し替えて実行します。

## 5) 環境変数
- `parents-portal/` 用: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
- 公開サイト（Vite）用: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

※ `SUPABASE_URL` と `ANON_KEY` は Supabase の Project Settings → API から取得します。
