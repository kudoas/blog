---
title: 非同期処理でハマったこと
date: 2020-03-01T09:43:00+09:00
description: "JavaSctipt 特有の非同期処理でのメモです。"
categories: ["program"]
tags: ["javascript", "async"]
images: ["tcard/async-nodejs.png"]
author: ["@kudoadd"]
---

JavaSctipt 特有の非同期処理でのメモです。

## 問題点

以下の処理はローカルファイルの json 形式のデータをパースして受け取るものです。
その json ファイルをタイトルが入っています。

```json
// data/products.json
[{"title":"hoge"},{"title":"hgoe"}] 
```

```javascript
// models
const fs = require("fs");
const path = require("path");

module.exports = class Product {
  constructor(t) {
    this.title = t;
  }
  
  static fetchAll(cb) {
    const p = path.join(
      path.dirname(process.mainModule.filename),
      "data", 
      "products.json"
    );
    fs.readFile(p, (err, fileContent) => {
       if (err) {
         return [];
       }
       return JSON.parse(fileContent);
     });
  }
};
```

これの JSON を controllers で受け取り、view にデータを渡します。

```javascript
// controllers
exports.getProducts = (req, res, next) => {
  Products.fetchAll(products => {
    res.render("shop", {
      prods: products,
      pageTitle: "Shop",
      path: "/",
      hasProducts: products.length > 0,
      activeShop: true,
      productCSS: true
    });
  });
};
```

ただし、これのコードでは json を受け取れず undefined になります。
問題は以下のコードです。

```javascript
static fetchAll() {
    const p = path.join(
      path.dirname(process.mainModule.filename),
      "data", 
      "products.json"
    );
  	// ①：ここが非同期処理なので処理が終わる前に通過してundefinedになる
    fs.readFile(p, (err, fileContent) => {
       // 内部の条件で値を返すが、fetchAll関数自体が値を返すわけではない。
       if (err) {
         return [];
       }
       return JSON.parse(fileContent);
     });
  }
```

データを読み込む処理①は条件内で値を返しますが、関数自体が値を返している訳ではありません。node.js では非同期通信なので①が終了して関数が値を返す前に、controller が view にデータを渡す処理が実行されてしまいます。

## 解決案

これを解決するための方法はいろいろあります。

- callback
- async/await Promise

### callback

fetchAll の引数に callback 関数を受け取る方法です。

```javascript
// callback で受け取る
static fetchAll(cb) {
    const p = path.join(
      path.dirname(process.mainModule.filename),
      "data", 
      "products.json"
    );
    fs.readFile(p, (err, fileContent) => {
       // 内部の条件で値を返すが、fetchAll() 自体が値を返すわけではない。
       if (err) {
         return cb([]);
       }
       return cb(JSON.parse(fileContent));
     });
  }
```

### async/await

Promise の async/await を使った方法です。これを使うと非同期処理を同期処理っぽく書くことができます。

```javascript
// models
static async fetchAll() {
	const p = path.join(rootDir, "data", "products.json");
  // await で処理が終わるまで待ってもらう
	const data = await fs.readFile(p);
	return JSON.parse(data);
}
```

```javascript
// controller
exports.getProducts = async (req, res) => {
	const products = await Product.fetchAll();
	res.render('shop', { prods: products, docTitle: 'Shop', path: '/' });
}
```

可読性が高いので、Nodejs のバージョンが対応していれば現在はこちらを使います。

## 所感

非同期処理は他の同期的な言語にない仕様であり、なかなか理解が難しいです。
また知見がまとまったら、まとめます。

## 参考文献

- [How do I return the response from an asynchronous call?](https://stackoverflow.com/questions/14220321/how-do-i-return-the-response-from-an-asynchronous-call)
- [ラーメンで理解するasync/await](https://qiita.com/7tsuno/items/6d5a27ffe9143b35defe)
- [Promiseの使い方、それに代わるasync/awaitの使い方](https://qiita.com/suin/items/97041d3e0691c12f4974)

