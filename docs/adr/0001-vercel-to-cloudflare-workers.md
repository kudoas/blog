# ADR 0001: Vercel から Cloudflare Workers への無停止移行

- 状態: Accepted（公開切り替え済み・監視中）
- 決定日: 2026-09-26

## 背景

ブログを Hugo / Vercel から Astro / Cloudflare Workers Static Assets に移す。
公開 URL `https://blog.da1chi.net` と既存の記事 URL は維持する。
2026-09-26 時点で、公開 DNS は Cloudflare の IP アドレスを返し、
HTTP 応答には `cf-ray` と `x-vercel-id` がある。
つまり Cloudflare を経由して Vercel の現行サイトが配信されている。
Vercel の `tech-blog` は同じ GitHub リポジトリの `main` から本番デプロイされている。

新構成では GitHub Actions が `main` の検証後に Worker をデプロイする。
そのため、公開経路を変更する前に両サービスの自動デプロイと切り戻しを制御する必要がある。

## 決定

1. 移行ブランチに `vercel.json` を追加し、`git.deploymentEnabled: false` で
   Vercel の Git 自動デプロイを停止する。旧本番デプロイ、ドメイン設定、DNS は保持する。
   `main` 反映後に Vercel の本番デプロイが置き換わっていないことを確認する。
2. Worker `tech-blog` を先にデプロイし、`workers.dev` URL で検証する。
   公開 Route はこの段階では追加しない。`wrangler.jsonc` にも公開 Route を定義せず、
   切り替え操作は Cloudflare ダッシュボードで管理する。
3. Cloudflare で既存の `blog.da1chi.net` DNS レコードがプロキシ有効であることを確認し、
   Worker に Route `blog.da1chi.net/*` を追加する。DNS レコードは変更しない。
   Route が有効な間、該当リクエストは Worker の静的アセットから配信する。
4. 実ドメインを検証し、1〜2週間監視する。問題があれば Route を削除し、
   同じ DNS 設定のまま Vercel の旧本番デプロイへ戻す。
5. Custom Domain 化と Vercel の退役は別の決定とする。
   確認期間後も、別計画が確定するまでは Vercel と DNS 設定を保持する。

## 採用理由と代替案

Cloudflare Route は既存のプロキシ有効なホスト名に Worker を割り当てられる。
初回切り替えと切り戻しに DNS の書き換えが不要で、旧サイトを退避先として維持できる。

- 最初から Worker の Custom Domain にする案は採用しない。既存 CNAME がある
  ホスト名には追加できず、公開 DNS の変更が先に必要になる。
- DNS を直接新しい配信先へ向ける案は採用しない。DNS の反映差により、
  切り替えと切り戻しを同じタイミングで全利用者へ適用できない。
- Vercel に新サイトを先にデプロイする案は採用しない。旧本番デプロイを
  切り戻し先として残す目的と合わない。

## 切り替え条件と切り戻し

切り替え前に、Vercel の旧本番デプロイ ID、Cloudflare の DNS レコードと
既存 Route、Worker のプレビュー URL を記録する。`bun run verify` と
`bun run test:e2e` を通し、プレビューでトップ、代表的な記事、画像、検索、
RSS、サイトマップ、OGP、旧 URL のリダイレクト、404 を確認する。
`main` 反映後は Cloudflare のデプロイ成功と Vercel の本番デプロイ ID が
変わっていないことを確認してから Route を追加する。

Route 追加後、実ドメインで同じ項目と HTTP ステータスを確認する。
新しい記事一覧が表示され、応答が Vercel の旧ページでないことも確認する。
5xx、主要 URL の 404、画像や検索の不具合があれば Route を削除する。
切り戻し後は実ドメインで旧サイトが表示されることを確認し、原因を調べる。

## 実施記録（2026-09-26）

- 切り戻し先の Vercel 本番デプロイ ID は `dpl_CBb7ctoXKzrTJi59FYyAUCBADtyd`。
- `vercel.json` を追加し、Vercel の Git 自動デプロイを停止する設定を用意した。
- Worker `tech-blog` の Version ID `b2eb5e78-10fb-4d96-868a-2a783615b0dd` を
  `https://tech-blog.first-developing1.workers.dev` にデプロイした。
- Worker の記事、画像、RSS、サイトマップ、旧 URL のリダイレクト、404 を確認した。
  公開 URL を対象にしたブラウザテスト 3 件も成功した。
- GitHub のリポジトリ共通シークレット `CLOUDFLARE_API_TOKEN` と
  `CLOUDFLARE_ACCOUNT_ID` の登録を確認した。
- PR #33 を `main` に反映し、GitHub Actions の検証と Worker デプロイが成功した。
  現行 Worker の Version ID は `ebbaedbe-4a37-48a6-b471-97cafe8d1337`。
  Vercel の本番デプロイ ID は変更されていない。
- Cloudflare で Route `blog.da1chi.net/*` を Worker `tech-blog` に設定した。
  実ドメインのトップ HTML は `workers.dev` と完全一致し、記事、旧画像、フォント、
  RSS、サイトマップ、旧 URL のリダイレクト、404 が期待どおり応答した。
  実ドメインを対象にしたブラウザテスト 3 件も成功した。
- 2026-09-26 から監視を開始。確認期間中は Vercel の旧本番と DNS 設定を保持する。

## 影響と残るリスク

初回の公開切り替えに計画停止は設けない。ただし Route の反映や運用ミスまで含めて
停止時間ゼロを保証するものではない。Vercel とその DNS 設定を維持する運用負担が残る。
Custom Domain への移行時には既存 CNAME の解消が必要で、Cloudflare の DNS 一括変更も
各拠点への反映は同時ではない。無停止を優先し、この変更を今回の実施範囲に含めない。

## 参照資料

- [Vercel Git Configuration](https://vercel.com/docs/project-configuration/git-configuration)
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare DNS の一括変更](https://developers.cloudflare.com/dns/manage-dns-records/how-to/batch-record-changes/)
