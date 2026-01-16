# 品川ユナイテッドアカデミー Web サイト

Vite を使った静的サイト（HTML/CSS/JS）。

追加で、以下を想定した土台があります。
- 一般公開の写真ギャラリー（`gallery.html` + Supabase）
- 保護者限定ポータル（`parents-portal/`：招待制ログイン + 写真投稿 + 運営承認 + 公開/限定の出し分け）

## セットアップ
- 必要: Node.js 18+ / Yarn 1.x
- 初回のみ:
  - `yarn install`

## 開発（ローカル）
```zsh
cd /Users/soratakahashi/study/sfc/sfc
yarn dev
# ブラウザで http://localhost:5173 を開く
```

### 一般公開ギャラリー（Supabase）
- `gallery.html` は Supabase の `posts`（`approved` + `public`）を読みます。
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を `.env` に設定してください。
  - 例: `cp .env.example .env` して値を埋める

## ビルド（本番用）
```zsh
cd /Users/soratakahashi/study/sfc/sfc
yarn build
# 出力は dist/ に生成
```

## GitHub Pages（本番デプロイ）
- このリポジトリは GitHub Actions で `yarn build` → `dist/` を GitHub Pages にデプロイします（`.github/workflows/deploy.yml`）。
- GitHub の Repository → Settings → Pages → Source を **GitHub Actions** に設定してください。
  - ブランチ（`main`）直配信にすると、`parents.js` 等が未ビルドのまま配信されて `@supabase/supabase-js` の解決エラーが出ます。
- `main` に push すると自動でデプロイされます（Actions タブで進捗確認）。

## 保護者限定ポータル（Next.js）
開発:
```zsh
cd /Users/soratakahashi/study/sfc/sfc/parents-portal
npm install
npm run dev
```

必要な環境変数は `parents-portal/.env.example` を参照してください。

- 例: `cp .env.example .env.local` して値を埋める
- `NEXT_PUBLIC_SITE_URL` は本番URL（例: `https://parents.example.com`）を指定します
  - Supabase 側の Auth → URL Configuration の Redirect URLs に `https://parents.example.com/*` も追加が必要です

ビルド:
```zsh
cd /Users/soratakahashi/study/sfc/sfc/parents-portal
npm run build
```

## Supabase セットアップ
`supabase/README.md` を参照してください（DB/RLS/Storage/招待制/運営admin設定）。

## 主要ファイル構成
- `index.html`: トップページ
- `gallery.html`: 一般公開 写真ギャラリー
- `style.css`: 全体スタイル（ヘッダー/ヒーロー/スライダー/フローなど）
- `reset.css`: リセット CSS
- `main.js`: スライダーとモバイルナビ（ハンバーガー）制御
- `img/`: 画像アセット
- `package.json`: Vite のスクリプト・依存関係
 - `parents-portal/`: 保護者ポータル（Next.js）
 - `supabase/`: DB/RLS/Storage のSQLと手順

## よく使う開発ポイント
- 画像スライダー: `.feature-slider` と `main.js`
- モバイルナビ: `.nav-toggle` と `header.nav-open`
- フロー（1日の流れ）: `.day-flow` / `.flow-item` / `.flow-content` / `.flow-media`

## Git の運用（push まで）
```zsh
cd /Users/soratakahashi/study/sfc/sfc
git status
git add .
git commit -m "update: layout and assets"
git push origin main
```
- push で 403 が出る場合:
  - フォーク先へ `origin` を差し替え
    ```zsh
    git remote set-url origin https://github.com/<あなたのアカウント>/sfc.git
    git push origin main
    ```
  - もしくは、元リポジトリにコラボレーターとして招待してもらう（PAT/SSH 設定）。

## トラブルシュート
- `fatal: not a git repository`: `.git` のあるディレクトリへ移動（例: `cd /Users/soratakahashi/study/sfc/sfc`）。
- `yarn dev` が起動しない: Node/Yarn のバージョン確認、`yarn install` の再実行。
- 画像のはみ出し/つぶれ: 該当セクターの `object-fit` と `height`/`max-height` を確認。

## ライセンス
本リポジトリの利用方針はリポジトリオーナーに従います。
