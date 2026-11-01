# ページ遷移のView Transition

## 現在の方式と対象範囲

一覧・記事・タグの切り替えに、Astroの `ClientRouter` とsame-document View Transitionsを使用する。
設定の正本は [`BaseLayout.astro`](../../src/layouts/BaseLayout.astro)。
ページ全体にAstro標準のfadeを160msで適用し、移動や拡大は加えない。
160msは初期のデザイン値で、速度改善の実測値ではない。

- 同一オリジンのリンク、検索ダイアログのフォーム送信、戻る・進むをClientRouterで処理する。
- タイトルやcanonicalなどのheadも遷移先に差し替え、Astroのルート読み上げを利用する。
- reduced motionではAstroのCSSがアニメーションを無効にする。API自体は呼ばれる場合がある。
- API未対応時は `fallback="swap"` によってアニメーションなしで画面を差し替える。
- JavaScript無効時は静的HTMLのリンクで通常のページ移動を行う。外部リンク・別タブ・ダウンロードはブラウザの通常動作を使う。
- 初回アクセス、再読み込み、同一ページの目次アンカー、ページ内の検索結果更新や配色変更には追加のアニメーションを実装しない。

## 初期案を変更した理由

当初のCSSだけのcross-document方式はFirefox系で未対応だった。
Zenでもアニメーションを有効にする要件に合わせ、Firefoxが対応するsame-document方式へ変更した。
クライアント側ルーターのJavaScriptとライフサイクル対応が増えるが、Astro標準機能を使い、依存パッケージは追加しない。
HTML・記事URL・検索用インデックスは引き続き静的に生成する。

## ページ差し替え後の初期化と後片付け

- コピー・ファビコン・記事の戻り先・長い目次は共通レイアウトから読み込む。初回と `astro:after-swap` で初期化し、`astro:page-load` でも重複しない。
- 初期化を `astro:page-load` だけに任せると、外部コメントスクリプトの通信完了まで操作部品が使えなくなる可能性がある。差し替え直後に操作できることをテストする。
- テーマは最初の描画前に決定する。`astro:before-swap` で次のHTMLへ引き継ぎ、差し替え直後にテーマ選択とコメント監視を付け直す。
- 検索ダイアログとテーマ選択の古いイベントはAbortControllerで解除する。コピーのタイマーも `astro:before-swap` で破棄する。
- Reactの検索条件更新は `history.state` を維持し、ルーターの履歴位置・スクロール情報を消さない。
- `document.referrer` はクライアント遷移で変わらないため、[`page-navigation.ts`](../../src/scripts/page-navigation.ts) が遷移元を記録する。通常の遷移では検索UIがreplaceStateした後のURL、履歴移動ではルーターの遷移元を使う。
- Giscusは `data-astro-rerun` で記事ごとに再実行する。記事間でiframeを永続化せず、遷移先の記事パスと現在の配色で作り直す。

## 検証と残るレビュー

[`view-transitions.spec.ts`](../../tests/e2e/view-transitions.spec.ts) で次を確認する。

- 同じドキュメント内で実際のViewTransitionがready/finishedに到達し、fadeが適用される。
- 戻る・進む、配色、遷移先のコードコピー、検索ダイアログが動作する。
- 検索・タグ条件と履歴情報を保持し、コメント・目次・検索が記事の再訪後も動作する。
- コメント通信が完了していなくても遷移先の操作部品が使える。
- reduced motion、API未対応、JavaScript無効の各条件でも移動できる。

通常のChrome全体E2Eに加え、FirefoxでもこのファイルをCIで実行する。
ローカルでは `E2E_BROWSER=firefox bun run test:e2e tests/e2e/view-transitions.spec.ts` で再現できる。
ブラウザが非表示タブなどでアニメーションを省略することは許容する。
コメントの回帰テストは外部通信をモックし、ライフサイクルと記事パス・配色を検証する。GitHubとの実接続の検証とは区別する。

Zen本体の確認では、ユーザーの通常プロファイルを使わず、一時プロファイルとWebDriver BiDiで内部リンク・戻る・進む・配色・検索を操作する。
バージョンと結果はPRの検証記録に残す。ヘッドレスでAPI発火を確認した結果であり、体感や描画品質の改善の証拠ではない。
Safari実機と、プレビューで長文をスクロールしてから移動した際の残像・待たされる感覚はドラフトのレビューに残す。
問題があればこのPRをrevertすれば通常のページ読み込みへ戻せる。データ移行はない。

## 参照

- [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/): ClientRouter・再実行・イベント・アクセシビリティ。
- [MDN: startViewTransitionの対応状況](https://github.com/mdn/browser-compat-data/blob/main/api/Document.json): Firefoxのsame-document API対応。
- [MDN: cross-document方式の対応状況](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/view-transition.json): 初期案を撤回した根拠。
- [MDN: WebDriver BiDi接続](https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection): Zen本体を検証する際の接続方法。
