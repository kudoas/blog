# Dev Container で Codex に実装から PR 作成まで任せる

## 実行範囲と構成

`blog-agent` は実装、ローカル検証、コミット、作業ブランチの push、PR 作成、CI の
確認まで行います。マージと本番デプロイは行いません。Preview は既存の GitHub Actions
が作成します。Cloudflare の資格情報はコンテナに渡しません。

Docker が Codex の実行境界です。非 root ユーザーで動かし、ホストのホームや
Docker ソケットは共有しません。コンテナ内の Codex は `approval_policy = "never"` と
`danger-full-access` でネットワーク、Git、ブラウザを操作します。与えた GitHub 資格情報
にもアクセスできるため、対象リポジトリ専用の資格情報を使用します。権限だけでは
main への push やマージを禁止できないため、必要に応じて GitHub のブランチ保護を設定します。

ソース、Codex 認証、GitHub 認証、実行状態、Bun キャッシュをそれぞれ専用の Docker
ボリュームに保存します。ホストの checkout は共有しません。ボリューム名には
Dev Container の識別子を含め、同じ環境の再ビルドで再利用します。

- `.devcontainer/Dockerfile`: ツールと Chromium の導入。Node/Bun は `package.json`
  との一致をビルド時に確認します。バージョン更新時は Dockerfile も更新します。
- `scripts/agent/run.mjs`: タスクの worktree、再試行、検証後の公開、CI 確認の正本。
- `scripts/agent/verify.sh`: 検証コマンドの正本。
- `.devcontainer/codex.config.toml`: 初回だけコピーする Codex 設定。モデルは固定しません。

## 初回セットアップ

Docker と VS Code の Dev Containers 拡張機能を用意し、このリポジトリで
**Dev Containers: Reopen in Container** を実行します。
イメージのビルド後、専用ボリュームに main を clone して依存関係を導入します。
コンテナ内のターミナルで認証とコミット用の名前を設定します。

```sh
codex login --device-auth
gh auth login --hostname github.com --git-protocol https
git config --global user.name 'YOUR NAME'
git config --global user.email 'YOUR EMAIL'
```

Codex の device auth はアカウントの設定で有効にする必要がある場合があります。
認証はボリュームに保存し、ホストの `~/.codex` をコピー・共有しません。
VS Code がホストの Git 設定や credential helper を自動転送するのを避けるには、
ホストの VS Code ユーザー設定で `dev.containers.copyGitConfig` を `false`、
`dev.containers.gitCredentialHelperConfigLocation` を `"none"` にします。
この環境のターミナルと自律実行では `SSH_AUTH_SOCK` を空にし、GitHub はコンテナ内の gh 認証を使います。
API キーで運用する場合は `codex login --with-api-key` の標準入力を使用します。
GitHub の fine-grained PAT なら対象リポジトリに Contents / Pull requests の書き込みと
Actions の読み取りを付与します。ワークフローを編集するタスクには追加権限が必要です。

この PR のマージ前に環境を開く場合は、Dev Container の `containerEnv` に
`"BLOG_REF": "feat/codex-devcontainer"` を一時指定して再作成してください。
既存ボリュームの checkout は bootstrap で強制的に切り替えません。

## タスク実行と再開

```sh
cat > /tmp/search-task.md <<'TASK'
検索画面の改善内容をここに記述する。
完了条件と変更してはいけない範囲も記述する。
TASK
blog-agent improve-search /tmp/search-task.md
```

タスク ID は小文字英数字とハイフン、最大64文字です。同じ ID と同じ指示で再実行すると
worktree、コミット、開いている PR を再利用します。失敗途中の変更も保持します。
終了した PR を再利用する場合や指示を変える場合は新しい ID を使用します。
モデルの会話を自動再開するのではなく、保存した作業内容と指示から新しい Codex 実行を開始します。
対話操作は通常の `codex` でも行えます。

処理は次の順に進みます。

1. 認証と Git の名前を確認し、`origin/main` を fetch する。
2. 新規タスクなら最新 main から `agent/<ID>` ブランチと専用 worktree を作る。
3. Codex が実装する。コミットと公開は実行スクリプトに任せる。
4. 依存関係を frozen install し、Chromium を準備する。
   `bun run verify`、E2E、Cloudflare dry-run が成功してからコミットする。
5. 作業ブランチを通常 push し、main を base に PR を作成する。既存 PR は再利用する。
6. 対象コミットの `ci` と登録された他のチェックが成功するまで確認する。
   ローカル検証か CI が失敗したらログを渡して修正を試みる。

既定は最大3回、認証確認から CI 待機まで合計2時間です。
変更する場合は `BLOG_AGENT_MAX_ATTEMPTS` と `BLOG_AGENT_TIMEOUT_SECONDS` を指定します。
起動だけではタスクを実行せず、同じ環境では `flock` で同時実行を防ぎます。
時限超過時は実行中のプロセス群を停止します。自動で main に変更したり force-push したりしません。
PR の head が検証対象と変わった場合は成功とせず終了します。

結果は `$BLOG_AGENT_STATE/<ID>/<実行時刻>/result.json` に保存します。
Codex イベントは `agent-*.jsonl`、モデルの報告は `agent-*.json`、
検証は `verify-*.log`、標準エラーはそれぞれ `.stderr`、CI は `ci-*.json` です。
時間切れや異常終了時は再実行してください。コンテナの強制終了では最終結果が書かれないこともあります。
ログにはコードやエラーが含まれるため、公開する前に内容を確認してください。

`CI=true` は検証の子プロセスにだけ設定します。これにより E2E は同梱 Chromium と
新しいプレビューサーバーを使います。Astro は `--ignore-lock` で前面実行します。
Playwright 更新時はイメージを再ビルドします。実行時にもプロジェクトのバージョンに
対応する Chromium を確認・導入します。

## 変更の確認と戻し方

```sh
# イメージのビルド
# build context を限定し、ホストの .env や認証情報を送らない
docker build -f .devcontainer/Dockerfile -t blog-codex:dev .

# 制御スクリプトの統合テスト（GitHub/Codex は代替コマンド）
node --test tests/agent/*.test.mjs

# コンテナ内のサイト全体の検証
bash /usr/local/lib/blog-agent/verify.sh
```

統合テストは `/etc/blog-devcontainer` があるコンテナ内で実行します。
実サービスへの Codex 認証・モデル実行・PR 作成は初回認証後の実タスクで確認します。
Dev Container の追加は既存の CI・公開構成に依存しません。戻す場合は追加ファイルと
README/AGENTS のリンク、Playwright の前面実行指定を revert します。
専用ボリュームには未公開コードや認証が残ります。再ビルドは削除操作ではありません。
不要なボリュームの削除は、未公開の変更を回収してから Docker 側で明示的に行います。

## 実装時の確認

2026-10-31 に macOS / Docker Desktop の Linux arm64 コンテナで確認しました。
Dev Containers CLI で新規作成、main の clone、依存導入、非 root 実行、専用ボリュームの
所有権、再起動後の設定保持を確認済みです。
制御スクリプトの統合テスト10件、単体テスト10件、生成サイト検証8件、Chromium E2E 9件、
Cloudflare dry-run が成功しました。既存記事の textlint 警告22件は残っています。
CI の `agent_container` でもイメージのビルド、制御スクリプトのテスト、サイト全体の検証を行います。

Codex / GitHub の実認証をコンテナへ移していないため、モデルから実 PR を作成する一連の
実行は未確認です。初回認証後に小さなタスクを実行し、保存された結果の SHA と PR の head、
CI 成功を照合してください。認証情報の更新を含む長期運用はこの検証に含みません。

参考: [Codex の承認と実行境界](https://learn.chatgpt.com/docs/agent-approvals-security)、
[非対話実行](https://learn.chatgpt.com/docs/non-interactive-mode)、
[認証](https://learn.chatgpt.com/docs/auth?surface=cli)、
[Dev Containers のボリューム](https://code.visualstudio.com/remote/advancedcontainers/improve-performance)。
