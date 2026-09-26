# daichi/tech

Astro で生成する日本語の静的ブログです。記事本文は Markdown で管理し、
外部の記事も同じ一覧に掲載します。React は一覧の検索とタグ絞り込みに使用します。

## 開発

Node.js 24 と Bun 1.4.2 を使用します。Bun がインストール済みなら、
次のコマンドで開始できます。

```sh
bun install --frozen-lockfile
bun run dev
```

`http://localhost:4321` でプレビューできます。主な確認コマンドは次のとおりです。

```sh
bun run verify          # textlint、型検査、単体テスト、ビルド、出力検証
bun run test:e2e        # ブラウザテスト
bun run preview         # 生成済み dist/ を確認
bun run preview:worker  # Cloudflare のリダイレクトと404を確認
```

ブラウザテストには Chrome を使用します。CI では Playwright の Chromium を導入します。
既存記事には textlint の警告が22件あります。移行時に本文を変更していません。

## 記事を書く

`content/ja/posts/<slug>.md` に Markdown を追加します。ファイル名が
`/posts/<slug>/` の URL になります。新しい記事には次の front matter を指定します。

```yaml
---
title: 記事のタイトル
date: 2026-09-25T12:00:00+09:00
description: 記事の説明
tags: [Astro, React]
categories: [DEV]
draft: true
images: [tcard/example.png]
---
```

`draft: true` は開発プレビューだけで表示します。公開時に `false` に変更してください。
古い記事のように `draft` がない場合は公開記事として扱います。
画像は `static/` に置き、`/posts/example.png` などのルート相対 URL で参照します。
既存記事の画像 URL とカード画像は維持しています。

外部記事は `content/external.yaml` に1件ずつ追記します。`id` は重複しない
kebab-case とし、`title`、`url`、`date`、`source` は必須です。
`tags`、`categories`、`description` は省略できます。
Zenn に限らず任意の掲載先を `source` に指定できます。

```yaml
- id: my-guest-post
  title: 外部の記事
  url: https://example.com/articles/my-guest-post
  date: "2026-09-25T12:00:00+09:00"
  source: Example
  tags: [Astro]
```

公開記事と外部記事を日付順に一覧へ表示します。検索はタイトルとタグが対象です。
RSS にはこのブログの Markdown 記事のみ含めます。

## 公開

無停止移行の判断と切り戻し手順は
[ADR 0001](docs/adr/0001-vercel-to-cloudflare-workers.md) に記録しています。

`wrangler.jsonc` は Astro の静的生成物 `dist/` を Cloudflare Workers の
Static Assets として配信します。API やサーバー処理はありません。
`vercel.json` は Vercel の Git 自動デプロイを停止し、切り戻し用の旧本番を保持します。
GitHub Actions は PR と `main` の push で検証を行います。同じリポジトリからの PR は
Worker `tech-blog` に `pr-<番号>` の Preview を作り、GitHub の `Preview` environment に
公開 Preview URL を表示します。PR を閉じると Preview を削除します。
`main` の検証が成功すると GitHub の `Production` environment から本番 Worker に
デプロイします。Cloudflare の認証情報は GitHub のリポジトリ、または両 environment に
`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を設定してください。
API トークンには対象アカウントの Workers 編集権限が必要です。
本番サイトへ切り替える際は Worker の `workers.dev` URL を先に検証し、
Cloudflare で既存の DNS レコードを維持したまま Route `blog.da1chi.net/*` を
Worker `tech-blog` に追加します。切り替え後は記事 URL、`_redirects`、404、RSS、
OGP を確認してください。

ローカルでの確認後、権限がある環境では `bun x wrangler login`、`bun run deploy` で
同じ検証を通してデプロイできます。現行サイトを切り替えるときは、
切り替え前のデプロイを戻せるよう残します。
デプロイ先の検索やモバイル表示は、
`E2E_BASE_URL=https://tech-blog.<subdomain>.workers.dev bun run test:e2e` で検証できます。
