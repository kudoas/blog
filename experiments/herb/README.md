# Herb版ブログ（ローカル実験）

本番Astro版を維持したまま、Rails 8.1＋ReActionView＋Herbで既存ブログを表示する実験です。まずはローカルで起動・比較する範囲を扱います。Cloudflareへの公開は行っていません。

## 起動

リポジトリのルートで初回セットアップを行います。

```sh
mise run herb:setup
```

次のコマンドでコンテンツを再ビルドしてRailsを起動します。

```sh
mise run herb:dev
```

<http://localhost:3000> を開きます。Astro版は従来どおり `bun run dev` で起動でき、ポート3000と4321で見比べられます。

記事本文は既存Astroビルドから受け取り、一覧・詳細・タグ／カテゴリ、検索、画像、RSS、PagefindをRailsから配信します。`build:herb`を再実行すると、Markdown・外部記事・静的アセットの変更が反映されます。

## あとで読む

記事一覧の「あとで読む」はブラウザ単位で保存され、RailsのセッションCookieに記事IDだけを保持します。保存上限は20件です。ログインや別ブラウザとの同期はありません。ReActionView Outboxで追加行を先に表示し、通信に失敗した場合は行から再試行または破棄できます。JavaScriptを無効にしても通常フォームで追加・解除できます。

記事一覧partialではHerbの`<style scoped>`を使い、追加操作のCSSをそのpartialが出力する要素に限定しています。scoped CSSの変換にはLightning CSSとHerbのVisitorを使います。

## 検証

```sh
bun run verify:herb
bun run test:e2e:herb
```

E2Eを別途起動済みのRailsへ向ける場合は `E2E_BASE_URL=http://127.0.0.1:3000 bun run test:e2e:herb` を使います。

Herb/ReActionViewは固定したmainのコミットからビルドした依存を使います。Herbのslots、状態更新、キー付き一覧、クライアントbehaviorは実験的なAPIです。
