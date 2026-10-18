# Herb版ブログのCloudflare Containers実験

状態: 設計案。実装・公開は未実施。

## 目的と前提

`experiment/herb`ブランチのブログをRails＋ReActionViewで動かし、CloudflareのURLで現行Astro版と比較する。`main`の本番運用は継続する。初回公開から現行機能をすべて揃える。Herb/ReActionViewのmainにあるReactivityとOptimistic UIを積極的に使う。

## 採用する構成

- Railsアプリ: `experiments/herb/`。ルートのMarkdown、外部記事YAML、CSS、画像を共有する。
- 配信: 専用Worker `tech-blog-herb` → Durable Object `BlogContainer` → Rails/Puma。URLはデプロイ結果の `workers.dev` URLを記録する。
- デプロイ: `experiment/herb`へのpushだけで専用workflowが通常の`wrangler deploy`を実行する。PR Previewのライフサイクルには依存しない。
- 設定: ルートの`wrangler.herb.jsonc`。既存`wrangler.jsonc`と区別する。
- 初期値: `basic`、`max_instances: 1`、固定インスタンス名`blog`、`defaultPort: 3000`、`sleepAfter: "5m"`。`@cloudflare/containers`のContainerクラスとdefault scheduling policyを用いる。
- Railsはproductionモード。Active Record、DB、ジョブ、メール、管理画面を導入しない。記事はイメージに同梱し、起動時に読み込む。更新は再ビルド・再公開する。
- 最初は画像・CSS・JavaScriptもRailsから配信する。全リクエストを同じ経路に通し、Static Assetsとの振り分けは評価後の最適化とする。
- 全レスポンスに`X-Robots-Tag: noindex`を付ける。canonicalは既存本番URL。記事の内部リンクは相対パスで実験サイト内に留める。

## 選択肢の比較

| 方式 | 評価 |
| --- | --- |
| 専用Workerへのブランチ限定デプロイ | 採用。固定の実験URLを持ち、本番と設定・終了処理を分けやすい |
| 同一WorkerのContainers付きPreview | 保留。公式に部分対応とされ、Preview削除後にコンテナアプリが残る場合がある |
| Astroの既存ページをブランチ内で全面置換 | 保留。同じチェックアウトで比較しにくく、記事表示の検証と基盤変更が混ざる |

## 初回公開の受け入れ条件

1. 公開済みの全記事と外部記事を日付順で表示し、全記事詳細を既存`/posts/<slug>/`で閲覧できる。記事本文・slug・元画像URLは変更しない。
2. 下書きは一覧・詳細から除外し、未指定のdraftはfalseとして扱う。不正メタデータ、外部記事id/url重複は起動前の検証で失敗させる。
3. 既存の青系1カラムCSS、Shikiのコード色付け、インラインHTML、改行、画像、見出しアンカーと目次を維持する。
4. タグ絞り込みをReActionViewのserver slotsで実装する。`herb_state`で現在の選択を読み、Rails側で記事を選別する。状態更新時にslots応答が発生し、一覧・件数だけが更新されることを確認する。
5. JavaScript無効でも一覧・詳細を読める。タグ絞り込みはGETフォームでも動き、URLの`tag`による再表示に対応する。ReActionViewの状態とURL同期の橋渡しは必要最小限のJavaScriptとする。
6. CSS・画像・クライアントJSが同一URL配下で読め、404は404を返す。モバイル幅390pxでページ全体の横はみ出しがない。
7. スリープ後の初回アクセス、再デプロイ、コンテナ再起動で同じ記事が読める。cold/warmの応答時間を記録する。

8. Pagefindの本文検索・外部記事検索・関連度順・抜粋強調・タグとの組み合わせ・IME・URL同期・履歴・クリア・空結果・索引失敗時fallbackを維持する。
9. タグ/カテゴリ一覧・詳細、全体/分類別RSS、sitemap、robots.txt、OGP、canonical、旧URL redirects、既存静的アセットを維持する。実験URLのnoindexだけを意図的な差とする。
10. 既存`tests/e2e/blog.spec.ts`全件をHerbに対して実行する。生成物検査をRailsレスポンス用にも適用し、機能を削って通さない。
11. ローカル開発の下書き表示とタイトル/タグ検索も維持する。公開productionでは下書きを除外し全文検索を有効にする。

工程は分けるが、機能が揃う前の公開は内部検証であり完成とは扱わない。

## 実装方針と不確実性

- 記事の変換と検索索引生成には既存Astroビルドを再利用する。`scripts/export-herb-content.ts`で検証済みメタデータと生成HTMLの本文・見出し・日付・タグをJSONにまとめる。記事本文の再解釈を避け、Shikiや既存アンカーを維持する。RailsはJSONを読み込み、ページと一覧はHerbで動的に描画する。Astroはビルド時のみに使い、コンテナでAstroサーバーは起動しない。
- RSS/sitemap/robots.txt/Pagefind/静的アセットは同じビルド成果物からRails publicへ選択的にコピーする。Astroのindex.htmlや記事HTMLはコピーせず、Railsルーティングを迂回させない。`static/_redirects`はRails middlewareで解釈し、元のルールを共有する。
- 依存はmainのSHAに固定する。調査時点はHerb `2283849f57e81982b946b6243fa250b667723c4f`、ReActionView `74b565e178e67d575e17f1cfa558eeb695c38641`。更新は新SHAへ明示的に変更し、同じ互換検証を通す。Railsは両mainと互換なリリース版を使用し、Rails mainまで無条件に広げない。
- HerbのRuby/CとクライアントJSを同じSHAからビルドする。ReActionViewのgemだけmainにして公開済みnpm/importmap assetを混ぜない。上流のbuild手順とasset manifest検証に従い、生成済みJSを含む再現可能な成果物を作る。Gemfile.lockに加えて`upstream-lock.json`へ両SHAとJSビルド由来を記録する。
- ReActionViewは`intercept_erb = true`、`slots = true`。公開環境のdev server・debug overlayは無効。main由来のビルド済みクライアントをRailsのimportmapへ登録する。

## ReactivityとOptimistic UIの使い分け

| 部位 | 活用する仕組み | 期待する挙動 |
| --- | --- | --- |
| 検索入力・タグ選択・選択条件表示 | server stateの`state.set`、identity slots | 入力を即時反映し、サーバー確認前でも反応する |
| 検索中・エラー・条件クリア・目次開閉 | 宣言的な`herb:state`、client slots、actions | 待機/分岐をブラウザで即時更新する |
| 記事一覧・検索結果・件数 | `herb:key`付きcollection、server slots | サーバー確定結果を差分反映し、記事IDに対応するDOMを維持する |
| 通信失敗・応答競合 | `StateReport.failed/restored/stale` | 確定状態へ復元し、古い応答を反映しない |

Pagefindは検索エンジンとして継続利用し、ReactはHerb版では使用しない。`src/lib/search.ts`の検索キューと正規化ロジックを再利用する。小さなJS adapterがPagefindとURL/IMEを接続し、DOMの更新はHerbに任せる。

検索は`state.set`のcustom transport内でPagefindを呼び、記事IDの順序と抜粋をRailsのslots endpointへ送る。同じtransportのPromiseに検索とRails応答を含め、Herbの競合判定・復元の対象とする。長い結果をURLに詰めずPOST JSONを使い、CSRFを保持する。Railsは既知の公開記事IDだけを解決し、抜粋はtextとmarkだけに制限する。外部記事は既存と同じく抜粋を表示しない。

索引の読み込み失敗は既存のタイトル/タグ検索へfallbackし、案内を表示する。Rails通信失敗は別扱いとし、確定済み結果とURLへ戻し、再試行用の入力はclient stateに保持する。pending/error/request世代はclient stateで管理し、古い完了処理で新しいpendingを解除しない。JS無効でもSSR記事一覧・詳細は閲覧できる。

Herbが自動で楽観更新できるのは主にidentity slots。Rubyで求める件数や検索結果を自動予測できるとは扱わない。未確定の件数を捏造せず待機表示にする。outboxは作成/更新操作向けなので、読み取り専用のブログに投稿機能を追加してまで使用しない。将来のコメント等では別途採用する。

mainの機能を利用することは必須だが、未検証APIを前提に全実装を進めない。最初に実際のmainから「入力→楽観反映→検索→slots確定→失敗復元」を小さく通し、そのAPI契約を後続タスクの基準にする。

- Workerはクエリ、Accept、Cookie、本文を保持して転送する。Railsが公開HTTPSを認識するよう信頼する転送ヘッダーをWorkerで設定し、公開Host・内部ヘルスチェックHostを限定許可する。SSLリダイレクトのループとslots応答の誤キャッシュを検証する。
- `SECRET_KEY_BASE`は実験専用SecretをWorkerからコンテナへ渡す。DockerイメージやGitに埋め込まない。DBを使わなくてもDurable Objectはコンテナ制御に必要。
- Workers PaidとContainers利用可否、APIトークンのコンテナ・イメージ公開権限は初回公開前に確認する。1インスタンス制限は課金の上限ではない。停止までのメモリ・ディスク等の費用を含めて評価する。

## 終了と切り戻し

実験ブランチを削除しても専用Workerは自動削除されない。実験workflowを停止後、`tech-blog-herb`に属するWorker、コンテナアプリ、不要なイメージをIDで確認して削除する。実験版の切り戻しは直前に検証したcommitからWorkerとイメージを再公開する。本番Workerを切り替える操作はない。

## 根拠（2026-10-18確認）

- [ReActionView導入](https://reactionview.dev/installation)
- [State and Actions](https://reactionview.dev/guides/state)
- [描画モード](https://reactionview.dev/guides/rendering-modes)
- [Containerクラス](https://developers.cloudflare.com/containers/api/container-class/)
- [Previewの分離・部分対応・削除時の注意](https://developers.cloudflare.com/workers/previews/resources/)
- [Containers料金](https://developers.cloudflare.com/containers/platform/pricing/)

## mainの一次ソース（SHA固定）

- [クライアントAPIとOptimistic UI](https://github.com/marcoroth/herb/blob/2283849f57e81982b946b6243fa250b667723c4f/javascript/packages/client/README.md)
- [server state実装](https://github.com/marcoroth/herb/blob/2283849f57e81982b946b6243fa250b667723c4f/javascript/packages/client/src/state/server.ts)
- [復元と競合のテスト](https://github.com/marcoroth/herb/blob/2283849f57e81982b946b6243fa250b667723c4f/javascript/packages/client/test/state.test.ts)
- [ReActionView依存条件](https://github.com/marcoroth/reactionview/blob/74b565e178e67d575e17f1cfa558eeb695c38641/reactionview.gemspec)
