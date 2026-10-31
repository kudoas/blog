# ページ間のView Transition

## 目的と現在の方式

一覧・記事・タグ間の画面切り替えを、短いクロスフェードでつなぐ。
設定の正本は [`src/styles/global.css`](../../src/styles/global.css) の `@layer base`。
同一オリジンのページ間移動に、ブラウザ標準のcross-document View Transitionを使用する。

- `prefers-reduced-motion: no-preference` の場合のみ `@view-transition { navigation: auto; }` で参加する。
- ページ全体の標準クロスフェードを160ms・ease-outにする。これは初期のデザイン値で、速度改善の実測値ではない。
- 移動・拡大や記事タイトル同士の変形は加えず、長い記事でも内容を追いやすくする。
- 初回アクセス、再読み込み、同一ページの目次アンカー、外部サイトへの移動には追加のアニメーションを実装しない。
- 動きを減らす設定では参加しない。未対応ブラウザはCSSを無視し、通常のページ遷移を行う。

## この方式を選んだ理由

現在はAstroが静的HTMLを生成し、検索のみReactで操作する構成。
テーマ設定、検索ダイアログ、コードコピー、目次、コメントは各ドキュメントの読み込み時に初期化される。
ブラウザの通常のナビゲーションを使うことで、そのライフサイクルとURL・履歴・フォーカス・スクロールの処理を維持する。
追加のクライアントJavaScriptや依存パッケージは不要で、JavaScript無効時もリンクは機能する。

Astroの `ClientRouter` も候補だが、ドキュメントを差し替える方式では既存スクリプトの再実行や後片付けの設計が必要になる。
今回の目的は画面の視覚的な接続なので、CSSによる参加だけで実現できる方式を採用した。
ページ内の検索結果更新やテーマ切り替えのアニメーションは今回の対象外。

## 確認方法と限界

[`tests/e2e/view-transitions.spec.ts`](../../tests/e2e/view-transitions.spec.ts) はChromeで次を確認する。

- `pagereveal` の実際の `viewTransition` が `ready` / `finished` に到達し、160msが適用される。
- 記事へのリンク、戻る・進む、配色の引き継ぎ、遷移先のコピーと検索ダイアログが動作する。
- reduced motionでは遷移の `viewTransition` が生成されず、スキップリンクが機能する。
- JavaScript無効時も記事を開き、履歴で戻れる。

通常の `bun run verify` とE2E全体も実行する。
これは遷移APIと既存操作の回帰確認であり、体感速度やCore Web Vitalsの改善を示すものではない。
ブラウザが遅い読み込みや非表示タブなどの条件でアニメーションを省略することは許容する。
Safari実機と未対応ブラウザでの表示、プレビュー上の体感は、ドラフトのレビューで確認する。
長文をスクロールした状態から移動しても、残像や待たされる感覚が気にならないことを採用条件とする。
問題があれば、CSSの参加設定と疑似要素の指定を削除すれば通常遷移に戻せる。

## 参照

- [Astro: View transitions](https://docs.astro.build/en/guides/view-transitions/): 標準のMPA方式とClientRouterの違い、スクリプトのライフサイクル。
- [MDN: @view-transition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition): 同一オリジンと双方の参加条件。
- [Chrome: Cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document): ブラウザの発火条件・省略条件、pagerevealによる観測。
