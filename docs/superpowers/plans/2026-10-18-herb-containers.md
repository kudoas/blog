# Herb版ブログ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回公開から現行機能をすべて揃え、Herb/ReActionView mainのReactivityとOptimistic UIを活用したブログをCloudflare Containersで評価する。

**Architecture:** `experiments/herb/`にRailsアプリを置き、専用Workerから単一Containerへ転送する。既存Astroビルドは記事本文・検索索引・feed等の生成に再利用し、公開HTMLとインタラクションはRails/Herbが担当する。

**Tech Stack:** Ruby、Rails、Herb/ReActionView main、Puma、TypeScript、Pagefind、既存Astroのコンテンツ処理、Wrangler、Cloudflare Containers、Playwright。

**Spec:** [設計案](../specs/2026-10-18-herb-containers-design.md)。設計・プランはレビュー待ち。今回は実装しない。

## Global Constraints

- ブランチ`experiment/herb`、Worker`tech-blog-herb`、設定`wrangler.herb.jsonc`。
- 初期値`basic`、`max_instances: 1`、固定インスタンス名`blog`、ポート3000、`sleepAfter: "5m"`。
- Herb SHA: `2283849f57e81982b946b6243fa250b667723c4f`。
- ReActionView SHA: `74b565e178e67d575e17f1cfa558eeb695c38641`。
- RubyとクライアントJSの由来を揃える。mainを毎回無条件にpullせず、更新SHAを検証して固定する。
- 記事本文・slug・元画像URLを維持する。公開時はdraft除外、開発時は既存同様表示する。
- 本番Astroのコード・公開経路を維持する。共通スクリプトの変更は既存の既定動作を保つ。
- 既存全機能が初回公開の必須範囲。工程上の試作を機能縮小の根拠にしない。
- レイアウト名・CSSクラスはkebab-case。rootのNode/Bun指定と既存Wrangler 4.141.0を出発点とする。
- 意図したファイルだけ検証後にローカルコミットする。push・公開はその時点の明示的な権限範囲で行う。

## Review Focus

- IME入力、クリア直後の遅延応答、ネットワーク失敗とURL復元（Task 1/3）。
- 外部記事・日本語タグ・重複id/url・draft・日時境界・未知slug（Task 2）。
- HTML風検索抜粋の実行防止と外部記事の関連度順（Task 3）。
- 旧URL・末尾slash・XML・静的画像とRailsルートの競合（Task 2/4）。
- Ruby/JSバージョン不一致・コンテナ再起動・古いCIジョブによる巻き戻り（Task 1/5/6）。

## Task 1: mainの契約を固定し、最小のReactive画面を通す

**Files:** `experiments/herb/{Gemfile,Gemfile.lock,.ruby-version,upstream-lock.json,Dockerfile}`、Rails生成ファイル、`config/initializers/reactionview.rb`、`app/javascript/application.js`、`scripts/build-herb-runtime.sh`、`test/integration/runtime_test.rb`、`tests/e2e-herb/runtime.spec.ts`。

**Interfaces:** `/up`は200。最小ページはHerbが描画する。stateのcustom transportは`{ state, changed }, AbortSignal`を受け、ReActionViewのslots payloadを返す。後続タスクに実際のwire formatと依存成果物を引き渡す。

- [ ] 指定SHAの両ソースと上流build/CIを読み、native extension、生成コード、asset manifest、クライアントJSのビルド方法を確定する。各SHA・toolchain・生成物digestを`upstream-lock.json`に記録する。
- [ ] 互換なRuby/Railsリリースを固定し、DB/ジョブ/メール/Storage/CableなしのRailsを作る。ReActionViewのgemとruntimeをmainからビルドして取り込む。公開済みJSへの暗黙fallbackを許さない。
- [ ] `intercept_erb = true`とslotsを有効化し、公開時のdebug/dev serverを無効にする。importmapへビルド済みruntimeを登録する。
- [ ] 先に失敗するテストを用意し、identity slotの即時更新、サーバー確定、`failed/restored/stale`、client stateの通信なし更新、keyed collectionの順序変更を実画面で通す。
- [ ] custom transportからCSRF付きPOSTで同じRails actionのslots形式を取得する。POST本文と`herb_state`の対応は実際のmainのstate_overrides実装に合わせ、契約テストで固定する。
- [ ] `bundle exec rails test`と専用Playwrightを実行し、Linux amd64 Dockerでもproduction起動する。更新が反映しない場合はmain利用を外さず、依存契約の問題として解決する。

## Task 2: 全記事・全ページの互換を実装する

**Files:** `scripts/export-herb-content.ts`、`experiments/herb/app/services/content_repository.rb`、`app/controllers/{articles,posts,taxonomies}_controller.rb`、`app/views/layouts/blog-layout.html.erb`、`app/views/{articles,posts,taxonomies}/`、`config/routes.rb`、`bin/prepare-assets`、`test/integration/content_test.rb`、`tests/unit/herb-export.test.ts`。

**Interfaces:** export出力は`experiments/herb/build/content.json`。`schemaVersion: 1`、`buildSha`、`posts`、`articles`、`taxonomies`を持つ。articlesは既存`ArticleSummary`の形、postsはslug・メタデータ・`bodyHtml`・`headings`。Rails `ContentRepository.new(path:)`、`articles`、`find_post(slug)`、`terms(field:)`、`filter(query:, tag:)`を提供する。

- [ ] メタデータは既存schemaで検証し、`buildArticleIndex`と`collectTerms`でJSONを作る。本文と見出しは同じAstroビルドの`dist/posts/<slug>/index.html`から抽出する。欠落ページ・重複・draft混入は失敗させる。
- [ ] 既存データとfixtureでexport/Rails双方を検査する。日付・同日順序・NFKCタグ・未知slug・下書き404・画像・Shiki・改行・HTML・見出しアンカーを含める。
- [ ] 全公開記事一覧、詳細、タグ/カテゴリ一覧と詳細をRails/Herbで描画する。既存CSS・OGP・canonical・外部リンク属性・アクセシビリティ文言を維持する。
- [ ] `prepare-assets`は静的画像、CSS、Pagefind、全体/分類別RSS、sitemap、robots.txtをコピーする。AstroのページHTMLをRails publicへコピーしない。Rails用404を作る。
- [ ] 開発モードではdraftを含む専用exportを生成する。public用成果物と混在させず、productionビルドは必ず作り直す。Markdown変更時にexportを更新する開発コマンドを用意する。
- [ ] 既存生成物テストの観測項目を共有helper化し、AstroのdistとHerbのHTTPレスポンスの両方で検査する。`bun run verify`とRubyテストを通す。

## Task 3: 全文検索をReActionViewの状態と差分描画に接続する

**Files:** `experiments/herb/app/javascript/{search-adapter,search-transport}.ts`、`app/views/articles/{index,_article-list,_article-card}.html.erb`、`app/controllers/articles_controller.rb`、`app/services/search_selection.rb`、`test/services/search_selection_test.rb`、`tests/e2e-herb/search-state.spec.ts`。

**Interfaces:** `src/lib/search.ts`の`searchArticles(articles, query, tag)`を再利用する。transportはPagefind結果の既知article ID順序・抜粋・query/tag・fallback状態をJSONでRailsへ渡す。Rails `SearchSelection.resolve(ids:, excerpts:, query:, tag:, fallback:)`が表示用の公開記事と安全な抜粋を返す。

- [ ] `herb:key`に`local:<slug>`/`external:<id>`を使う。元のReactコンポーネントは本番用に残し、Herbページでは読み込まない。DOMはHerbだけが更新する。
- [ ] query/tagはserver state、pending/error/IME/再試行用draftはclient stateで持つ。入力・選択条件は即時反映、結果と件数はslots応答で確定する。小さな表示分岐にはclient slotsを使う。
- [ ] Pagefind検索→結果読込→Rails slots取得をcustom transportの1回の処理にまとめる。既存検索キューと300ms debounceを保ち、Herb側のdebounceと二重に待たせない。IME中は検索要求を出さない。
- [ ] サーバーは公開記事IDのallowlistを使い、結果順序を保持する。抜粋はmarkとtext以外を実行可能HTMLにしない。生のリクエストHTMLをhtml_safeにしない。
- [ ] Pagefind失敗時は案内とタイトル/タグ検索へ切り替える。Rails失敗時はHerbの復元結果に合わせ確定済み一覧・URLへ戻す。再試行入力を保持する。古い完了処理で最新のpending/errorを書き換えない。
- [ ] q/tagのURL同期・再読込・popstate・クリア・0件・外部記事・関連度順・強調抜粋を実装する。JS無効時はSSR一覧/記事を表示する。開発モードは既存同様タイトル/タグ検索のみ。
- [ ] 既存`tests/e2e/blog.spec.ts`全件をHerb URLに実行する。追加で遅延/500/abort/連続選択を注入し、即時更新・復元・古い応答破棄・collection順序とDOM保持を確認する。

## Task 4: 経路・配信・UIの完全互換を確認する

**Files:** `experiments/herb/lib/legacy_redirects.rb`、`config/application.rb`、`test/integration/compatibility_test.rb`、`playwright.herb.config.ts`、`tests/e2e-herb/compatibility.spec.ts`。

**Interfaces:** `static/_redirects`を単一のルール源としてRails middlewareが301を返す。`E2E_BASE_URL`指定時は専用Playwrightもローカルサーバーを起動しない。

- [ ] `_redirects`全ルールの具体例・パラメータ展開・クエリ保持・末尾slashをテストし、既存ルール形式に絞ったmiddlewareを実装する。Railsではファイルを置くだけで適用されない。
- [ ] RSS全件/分類別件数、sitemap全URL、robots、OGP、canonical、全旧画像をHTTPで検証する。未実装リンクを隠してテストを通さない。
- [ ] デスクトップ/390px幅・キーボードfocus・JS無効・目次リンクを検証し、Astro/Herb比較スクリーンショットを保存する。
- [ ] 既存Playwright全件とHerb追加テストを1コマンドで実行できるようにする。Pagefind索引に公開記事と外部記事だけが含まれることも確認する。

## Task 5: Cloudflare Workerとコンテナを接続する

**Files:** `wrangler.herb.jsonc`、`experiments/herb/worker/{index.ts,index.test.ts,tsconfig.json}`、`experiments/herb/config/{puma.rb,environments/production.rb}`、Dockerfile、root package.json/bun.lock。

**Interfaces:** `BlogContainer extends Container`、binding `BLOG_CONTAINER`。Worker fetchは固定名`blog`へ転送する。`/up`はRailsまで到達する。

- [ ] 通常デプロイ用トップレベルcontainers/binding/SQLiteクラスmigrationを設定する。Preview用設定を使わない。Docker build contextをrootにし、ビルド成果物とRailsだけを最終イメージへ含める。
- [ ] `SECRET_KEY_BASE`を実験専用Worker Secretから実行時に渡す。production用静的配信とasset precompileを設定する。ローカルDockerはlinux/amd64で検証する。
- [ ] WorkerはAccept・Cookie・本文・queryとレスポンスContent-Typeを保持する。公開Host/HTTPSの信頼する転送ヘッダーを設定し、SSLループ・CSRF失敗を防ぐ。Railsの許可Hostに公開URLと必要な内部health checkを限定する。
- [ ] 全応答にnoindex、HTML/slotsにno-storeを付け、起動失敗は503を返す。Workerの変換部分をunit testで検証する。
- [ ] `bun x wrangler dev -c wrangler.herb.jsonc`経由で既存全E2EとHerb追加テストを実行する。5分無通信後・再起動後の表示と検索、cold/warm時間を記録する。

## Task 6: ブランチ限定公開と全機能デモ

**Files:** `.github/workflows/herb.yml`、`experiments/herb/bin/{verify,smoke}`、`experiments/herb/README.md`、root package.json。

**Interfaces:** `bun run verify:herb`はexport・Ruby・Worker検証、`bun run test:e2e:herb`は既存全E2E＋Herb追加E2E。既存`bun run verify`も維持する。

- [ ] 自動公開は`push.branches: [experiment/herb]`だけ。手動実行にもref条件を付ける。GitHub environmentはHerb、concurrencyはherb、公開途中をcancelしない。公開直前にbranch HEADを確認し、古いジョブはskipする。
- [ ] pipelineは既存verify→export→Ruby/JS/runtime build→Herb test→Docker/Worker E2E→deployとする。同一commitの本文・索引・runtimeを1イメージにまとめる。
- [ ] 初回公開前にWorkers Paid、APIのContainer/Registry権限、Secret、専用Worker名を確認する。公開コマンドは`bun x wrangler deploy -c wrangler.herb.jsonc`。
- [ ] 返されたURLへ有限リトライ付きreadiness check、その後全E2Eを実行する。本番URLの同じ記事・検索・feedと比較し、HTTPS・404・noindexも確認する。
- [ ] デモは「本文検索＋タグ→IME→クリア→戻る→索引失敗fallback→slots通信の遅延/失敗→復元→RSS/旧URL→再起動後の検索」とする。未確定結果を確定として表示しないことを示す。
- [ ] READMEに固定SHA、ビルド再現手順、公開URL、cold/warm結果、月額費用の観測、前commitのWorker/イメージ再公開、実験終了時の専用リソース削除を記録する。ブランチ削除だけでは停止しない。
- [ ] 全チェック後に意図したファイルだけローカルコミットする。push・公開の未実施事項は区別して報告する。

## 完了条件と検証の限界

既存の全機能の互換とmain由来のReactivity/Optimistic UIの実動作を、公開URLで検証した時点で完了。基盤だけ・一部ページだけの起動では完了にしない。

このプランではmainのREADME・state実装・復元/競合テスト、ReActionView依存条件、Cloudflare資料を静的確認した。上流テスト実行、mainからのビルド、Rails/Container作成、Cloudflare公開はまだ実施していない。
