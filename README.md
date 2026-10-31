# daichi/tech

Astro で生成する日本語の静的ブログです。記事本文は Markdown で管理し、
外部の記事も同じ一覧に掲載します。React は一覧の検索とタグ絞り込みに使用します。

## 開発

Node.js と Bun のバージョンは `package.json` に指定しています。Bun がインストール済みなら、
次のコマンドで開始できます。

```sh
bun install --frozen-lockfile
bun run dev
```

`http://localhost:4321` でプレビューできます。主な確認コマンドは次のとおりです。

```sh
bun run verify          # textlint、型検査、単体テスト、ビルド、出力検証
bun run test:e2e        # ブラウザテスト
bun run preview         # 生成済み Cloudflare Build Output を確認
bun run preview:worker  # cf dev で開発サーバーを起動
```

ブラウザテストには Chrome を使用します。CI では Playwright の Chromium を導入します。
既存記事には textlint の警告が22件あります。移行時に本文を変更していません。

## 記事を書く

`content/ja/posts/<slug>.md` に Markdown を追加します。ファイル名が
`/posts/<slug>/` の URL になります。新しい記事には次の front matter を指定します。

```yaml
---
title: 記事のタイトル
icon: "🪐"
date: 2026-09-25T12:00:00+09:00
description: 記事の説明
tags: [Astro, React]
categories: [DEV]
draft: true
images: [tcard/example.png]
---
```

`icon` は省略可能な絵文字アイコンです。指定すると、記事ページのタイトル上部へ大きく表示します。
未指定の記事にはアイコンやそのための余白を表示しません。一覧・RSS・OG画像には反映しません。
絵文字の見た目は閲覧環境のフォントに依存します。

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

公開記事と外部記事を日付順に一覧へ表示します。検索すると Pagefind の関連度順で
表示します。ブログ内はタイトル・タグ・本文、外部記事は `external.yaml` に登録した
タイトル・タグ・説明が検索対象です。外部サイトの本文は取得しません。
ブログの記事には検索語を強調した抜粋を表示します。
RSS にはこのブログの Markdown 記事のみ含めます。

`bun run build` は `cf build` から Astro を実行し、ビルド完了フックで Pagefind の索引を生成します。
HTML と索引は `.cloudflare/output/v0/workers/default/assets/` に出力します。
公開記事だけを対象とし、目次・ナビゲーション・一覧ページは索引に含めません。
記事を更新したら再ビルドして、HTML と索引を一緒に公開してください。

全文検索の確認には `bun run build` の後に `bun run preview` を使用します。
`bun run dev` はタイトル・タグ検索のみです。公開サイトで全文検索の読み込みに
失敗した場合も、画面で案内したうえでタイトル・タグ検索を使用します。

## 記事本文のリンク表示

Markdownのリンク（文章中・箇条書き・単独URL・参照形式）は、リンク先のアイコンと
ページタイトルで表示します。記事本文とリンク先URLは書き換えません。
ページ内アンカー、メール、コード、画像をリンクにした箇所は変換しません。
見出し中のリンクを変換しても、元の見出しアンカーを維持します。

リンクを追加・更新したときは次を実行し、取得結果を確認してコミットします。

```sh
bun run links:update
bun run verify
```

タイトルと外部favicon URLの正本は `content/link-metadata.json` です。
アイコン画像はリポジトリにもビルド成果物にも保存しません。
通常のビルドは保存済みメタデータを使い、外部サイトへ問い合わせません。

更新時は `og:title`、なければHTMLの `title` を取得し、HTTPSの `rel="icon"` のURLを
保存します。指定がなければページのオリジンの `/favicon.ico` を使います。
ページを取得できない場合は前回のデータを維持し、データがなければ元のリンク文字を表示します。
更新できないリンクがあるとコマンドは対象URLを報告して非ゼロ終了しますが、
取得済みのデータは保存されます。通常のビルドは取得失敗で止まりません。
手動でタイトルやアイコンURLを調整する場合はJSONを編集できます（更新コマンドの再実行で上書きされます）。

閲覧時はブラウザから保存済みのfavicon URLを直接、遅延読み込みします。
`referrerpolicy="no-referrer"` で記事URLは送信しませんが、閲覧者のIPアドレスは
アイコン配信先に伝わります。JavaScript有効時は読み込み失敗したアイコンを非表示にし、
タイトルとリンク先を維持します。JavaScript無効時もタイトルとリンクを利用できます。

## コメント・リアクション

公開記事の末尾に [giscus](https://giscus.app/ja) を表示します。
コメントと記事へのリアクションは `kudoas/blog` の GitHub Discussions
（Announcements カテゴリ）に保存され、投稿には閲覧者自身の GitHub ログインが必要です。
リポジトリの Discussions と [giscus GitHub App](https://github.com/apps/giscus) を有効にしてください。
ブラウザや CI に管理用トークンを渡す必要はありません。

接続先のリポジトリ ID・カテゴリ ID は `src/site.ts` の `comments` が正本です。
カテゴリを削除・再作成したりリポジトリを移したりする場合は、[giscus の設定画面](https://giscus.app/ja)
で新しい ID を確認して更新します。
記事の固定パス（例: `/posts/func-error-boundary/`）を厳密照合し、タイトルやクエリの変更では
コメントを分割しません。Preview と本番は同じ記事のコメントを共有し、Discussion の
記事リンクは本番の canonical URL に固定します。パス自体を変更する場合は Discussion の
タイトルと厳密照合用ハッシュの移行も必要なので、既存パスを維持してください。

下書きと一覧には読み込まず、公開記事では iframe を遅延読み込みします。
JavaScript が無効、または外部サービスが利用できない場合も、記事末尾の
「GitHub でコメントを見る」から作成済みの Discussion を開けます。
記事ごとの Discussion は最初のコメントまたはリアクションで自動作成されます。
まだ作成されていない記事への初回投稿には、記事上の giscus 欄を使用してください。
管理・編集・削除は GitHub Discussions
で行い、リアクションの変更は投稿した GitHub アカウントで行います。
外す場合は記事ページの `PostComments` と backlink メタデータを削除します。
既存のコメントは GitHub に残り、アプリ連携を外しても自動削除しません。

## 公開

無停止移行の判断と切り戻し手順は
[ADR 0001](docs/adr/0001-vercel-to-cloudflare-workers.md) に記録しています。

`cloudflare.config.ts` は Cloudflare Workers の配信設定を管理します。
Cloudflare CLI (`cf`) と Astro の公式 Cloudflare アダプターを使用し、
Astro と Pagefind の生成物を Static Assets として配信します。
API やサーバー処理はありません。セッション用 KV と画像処理サービスも使用しません。
`cf` と対応アダプターはベータ版のため、プロジェクトの依存バージョンを固定しています。
`vercel.json` は Vercel の Git 自動デプロイを停止し、切り戻し用の旧本番を保持します。
GitHub Actions は PR と `main` の push で検証を行います。同じリポジトリからの PR は
Worker `tech-blog` に `pr-<番号>` の Preview を作り、GitHub の `Preview` environment に
公開 Preview URL を表示します。PR を閉じると Preview を削除します。
`main` の検証が成功すると GitHub の `Production` environment から本番 Worker に
デプロイします。Cloudflare の認証情報は GitHub のリポジトリ、または両 environment に
`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を設定してください。
API トークンには対象アカウントの Workers 編集権限が必要です。
公開サイト `https://blog.da1chi.net/` では Astro 版を配信しています。
変更を公開した後は記事 URL、`_redirects`、404、RSS、OGP を確認してください。
公開経路の切り替え判断と当時の手順は ADR に残しています。

`bun run build` で `.cloudflare/output/v0/` を生成し、
`bun x cf deploy --prebuilt --mode production --dry-run` でアップロードせずに検証できます。
`bun run preview:worker` は `cf dev` で開発サーバーを起動します。
`cf` は Node.js で実行してください。Bun は依存管理とスクリプト実行に使用します。

ローカルでの確認後、権限がある環境では `bun x cf auth login`、`bun run deploy` で
同じ検証を通してデプロイできます。切り戻しに備え、直前のデプロイと
Vercel の旧本番を保持します。
デプロイ先の検索やモバイル表示は、
`E2E_BASE_URL=https://tech-blog.<subdomain>.workers.dev bun run test:e2e` で検証できます。
