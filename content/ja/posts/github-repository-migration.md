---
title: GitHubのリポジトリを履歴を残したまま他のリポジトリへ移行する方法
date: 2022-12-13T23:03:00+09:00
description: "リポジトリをまとめるために、リポジトリから他のリポジトリに履歴を残したまま移行しました。そのとき行った方法です。"
author: daichi
categories: ["DEV"]
tags: ["GitHub"]
images: ["tcard/github-repository-migration.png"]
---

リポジトリをまとめるために、リポジトリから他のリポジトリに履歴を残したまま移行しました。そのとき行った方法です。

## やりたいことのイメージ

```
.
├── 移行したいリポジトリ (base_repo)
└── 移行先のリポジトリ (target_repo)
    └── /target <- ここに「移行したいリポジトリ」を移行する
```
※ ただしこの場合ディレクトリの階層が異なるため、移行したいリポジトリの履歴と移行先のリポジトリの履歴が合わなくなります。
そのため、全体の階層を含めた履歴ではなく、**ファイルの履歴だけの変更だけ取っておきたい**目的と割り切って使用した方が良いです。

## 使用したバージョン

- git 2.38.1

## 手順

### 移行先のリポジトリ に 移行用のディレクトリ を作成する

移行したいリポジトリのルートディレクトリで移行用のディレクトリを作成します。（コミットに反映されるように `.gitkeep` を置いています。）

```sh
$ mkdir target
$ touch target/.gitkeep
$ git add .
$ git commit -m "リポジトリの移行先のディレクトリを作成"
```

### 移行先のローカルリポジトリ に 移行したいリモートリポジトリ を登録する

移行したいリモートリポジトリからコミット履歴を fetch するために、移行したいリモートリポジトリを登録します。

```sh
$ git remote add <登録したい任意の名前> <GitHubのURL（ssh, httpsなど）>
```

### 登録したリポジトリのコミット履歴を移行先のローカルリポジトリに反映する

先ほど登録したリポジトリを使ってコミット履歴を fetch し、移行先のリポジトリに反映します。

```sh
$ git fetch <登録した任意の名前>
...
From <GitHub URL>
 * [new branch]      main     -> <登録した任意の名前>/<ブランチ名>
...
```

fetch できたことを確認して移行したいディレクトリに merge します。

```sh
// git merge --allow-unrelated-histories -X subtree=<移行したいディレクトリ名> <登録した任意の名前>/ブランチ名
$ git merge --allow-unrelated-histories -X subtree=target target_repo/main
```

今回は移行したいリポジトリが移行先のリポジトリ内のディレクトリに移動させるため、エラー無視して反映できるように `--allow-unrelated-histories` が必要です。


## 参考

- [--allow-unrelated-histories](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---allow-unrelated-histories)
