---
title: Nodejsで環境変数を設定できるdotenvの紹介
date: 2020-05-26T09:43:00+09:00
description: "Node.js で API を作っていた時に Production Key や DB のパスワードをハードコーディングして GitHub に上げてしまうのは気が引けた。調べてみると Nodejs には環境変数を簡単に設定できるdotenvというモジュールがあったので使い方のメモです。"
categories: ["development "]
tags: ["dotenv"]
images: ["tcard/dotenv-js.png"]
author: ["@kudoadd"]
---

Node.js で API を作っていた時に Production Key や DB のパスワードをハードコーディングして GitHub に上げるのセキュリティ的に良くありません。調べてみると Nodejs には環境変数を簡単に設定できる**dotenv**というモジュールがありました。今回はその使い方のメモです。

## dotenvの使い方

`dotenv`をインストールするだけで使用できます。

```bash
$ yarn add dotenv
```

そしてメインのファイルで以下のように使用します。

```typescript
import * as dotenv from "dotenv";

dotenv.config();
```

たったのこれだけで OK です。
こうすることで開発環境では.env ファイルから `process.env` 経由で環境変数が読み込まれ、本番環境ではホスティング先で環境変数を設定すればよいです。

## 実装例

以下の例は Mongoose を利用した MongoDB との接続方法についてです。

### フォルダ構造

```reStructuredText
root
├── index.ts
└── .env
```

### .env

```bash
MONGO_DB_URL = "DB_URL"
```

### index.ts

```typescript
import * as mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

mongoose
  .connect(process.env.MONGO_DB_URL)
  .then((result) => {
    app.listen(8080);
  })
  .catch((err) => console.log(err));
```

GitHub に push する際は `.env` を ignore することをお忘れなく。
