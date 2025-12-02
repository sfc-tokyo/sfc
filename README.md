# 品川ユナイテッドアカデミー Web サイト

Vite を使った静的サイト（HTML/CSS/JS）。ローカル開発、ビルド、デプロイ、Git の運用手順をまとめています。

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

## ビルド（本番用）
```zsh
cd /Users/soratakahashi/study/sfc/sfc
yarn build
# 出力は dist/ に生成
```

## 主要ファイル構成
- `index.html`: トップページ
- `style.css`: 全体スタイル（ヘッダー/ヒーロー/スライダー/フローなど）
- `reset.css`: リセット CSS
- `main.js`: スライダーとモバイルナビ（ハンバーガー）制御
- `img/`: 画像アセット
- `package.json`: Vite のスクリプト・依存関係

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
