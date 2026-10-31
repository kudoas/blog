# PR Preview の削除と 403 の復旧

## この文書が答える問い

PR 終了時の Preview 削除が失敗したとき、どこまで確認済みで、何を確認すれば再開できるかを記録する。
現行の実行処理は [CI workflow](../../.github/workflows/ci.yml) の `preview_cleanup` が正本である。

## 現在の状態

Preview の作成と本番デプロイは成功しているが、Preview の削除は `403 Forbidden` で失敗する。
自動削除の復旧と実リソースの削除成功は未完了である。失敗を成功扱いにしたり、403 を無視したりしない。

- 初期の失敗例: [PR #106 の終了時](https://github.com/kudoas/blog/actions/runs/41216006699)。
- 切り分け: [PR #109 の一時 Preview に対する診断](https://github.com/kudoas/blog/actions/runs/41217165977)。
- 診断コードのコミット: [`6c4780b`](https://github.com/kudoas/blog/commit/6c4780b7a05bbd3997537951f2ac74c4d57300ba)。診断用処理は通常の workflow から撤去した。
- 検証した CLI: `cf 1.0.0-beta.26`。Node.js `26.13.0`、Bun `1.4.4`、GitHub Actions の Preview 環境。

## 同じ認証での実 API の比較結果

診断対象は、この PR 専用に作成した `cleanup-probe-pr-109` のみである。
本番や他 PR のリソースを削除する検証は行っていない。

| 操作 | 結果 |
| --- | --- |
| `cf previews deploy` による一時 Preview 作成 | 成功 |
| Worker 名による Worker の GET | 200 |
| Preview 名による Preview の GET | 200 |
| `cf previews delete` による名前指定の DELETE | 403 |
| 同じ URL への直接の DELETE | 403 |
| Preview ID 指定の DELETE | 403 |
| Worker ID と Preview ID 指定の DELETE | 403 |
| 削除試行後の Preview の GET | 200。削除されていない |

CLI と直接 API の両方、名前と ID の両方で再現するため、CLI 固有・名前解決固有の問題とは判断していない。
作成直後のリソースでも再現しており、PR 終了イベントだけの問題でもない。

固定版 CLI のソースと [Cloudflare 公式 API スキーマ](https://github.com/cloudflare/api-schemas/blob/main/openapi.yaml)を照合し、以下を確認した。

- `DELETE /accounts/{account_id}/workers/workers/{worker_id}/previews/{preview_id}` は仕様どおりの経路。
  `workers/workers` を独自に書き換えない。
- Worker は名前または ID、Preview は ID・slug・URL エンコードした名前を受け付ける定義になっている。
- 削除の受理権限は `Workers Scripts Write` と定義されている。
- ダミートークンを使って通信を差し替え、CLI が正しい Bearer 認証ヘッダーを送ることも確認した。

**残る不確実性:** 現在の CI トークンの権限・リソース条件と、Cloudflare 側の実際の認可判定は未確認。
403 だけから権限不足や Cloudflare の不具合と断定しない。トークン値や権限情報を CI ログへ出さない。

## 復旧のために確認すること

1. GitHub の `Preview` 環境で使用する `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` の組み合わせを、管理画面で確認する。
2. Cloudflare の管理画面で、対象アカウントに対する `Workers Scripts Write` 相当の権限と、リソース・IP・有効期限などの条件を確認する。
   実トークンの値を Issue・PR・チャットへ貼り付けない。
3. 定義どおりの権限と条件を満たしている場合は、上記の再現結果を根拠に Cloudflare 側の認可を調査する。
   原因未確定のまま Admin 権限へ拡大しない。
4. 認証の問題を解消したら、自分の PR 用に作成した Preview を削除し、API で存在しないことを確認する。
   削除 API の成功と URL が配信されなくなることは別々に確認する。
5. 最後に PR を終了した際の `preview_cleanup` が成功することを確認する。

[Cloudflare の Workers 権限の説明](https://developers.cloudflare.com/workers/authorization/workers/)も参照する。
トークンの再発行・権限変更や GitHub Secrets の更新は、この PR では行っていない。

## 残存 Preview

診断終了時点で `cleanup-probe-pr-109` は削除できず残っている。
`pr-109` はレビュー用の通常 Preview で、PR 終了時に削除する対象である。
過去に失敗した他 PR の Preview の存在や削除は、この診断では確認していない。

認証が利用できる環境で、対象を確認してから実行する。

```sh
bun x cf previews delete cleanup-probe-pr-109 --worker tech-blog --force
```

`--force` は対話確認を省略する指定であり、403 を回避する指定ではない。
`--delete-with-references` は他 Worker からの参照を壊し得るため、この復旧目的では付けない。
