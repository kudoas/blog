# Herb版ブログ（ローカル実験）

本番Astro版を維持したまま、Rails 8.1＋ReActionView＋Herbで既存ブログを表示する実験です。まずはローカルで起動・比較する範囲を扱います。Cloudflareへの公開は行っていません。

## 起動

リポジトリのルートで一度、記事本文・検索索引と静的ファイルを生成します。

```sh
bun install --frozen-lockfile
bun run build:herb
```

続けてRailsを起動します。

```sh
cd experiments/herb
mise exec ruby@4.0.6 -- bundle install
mise exec ruby@4.0.6 -- bundle exec rails server -p 3000
```

<http://localhost:3000> を開きます。Astro版は従来どおり `bun run dev` で起動でき、ポート3000と4321で見比べられます。

記事本文は既存Astroビルドから受け取り、一覧・詳細・タグ／カテゴリ、検索、画像、RSS、PagefindをRailsから配信します。`build:herb`を再実行すると、Markdown・外部記事・静的アセットの変更が反映されます。

## 検証

```sh
bun run verify:herb
bun run test:e2e:herb
```

E2Eを別途起動済みのRailsへ向ける場合は `E2E_BASE_URL=http://127.0.0.1:3000 bun run test:e2e:herb` を使います。

Herb/ReActionViewは固定したmainのコミットからビルドした依存を使います。Herbのslots、状態更新、キー付き一覧、クライアントbehaviorは実験的なAPIです。
