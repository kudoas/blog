---
title: "ゆめみのインターンに参加した"
date: 2020-12-06T09:00:00+09:00
description: ""
categories: ["DEV"]
tags: ["intern"]
images: ["tcard/yumemi-intern.png"]
---

こんにちは、だいちです。

11/16(月)から 11/20(金)の 5 日間、[ゆめみ](https://www.yumemi.co.jp/)さんでフロントエンドエンジニアインターンをしてきました。

<!--more-->

## インターン中の課題

このインターンではベースとして、Figma のデザインカンプを元に画面を作成するという課題が与えられていました。ただそこまで厳密にやることが決まっていた訳ではなかったので、自分が学びたい・経験したいことを自由にやらせて頂きました。

### やりたいと言ったこと

- コンポーネントの切り出しと管理しやすい設計方法
- フロントエンド開発でのツール周り（静的解析、自動テスト・デプロイ、その他実務で使用していること）
- パフォーマンスを上げるための工夫
- フロントエンドのテストの使い分け（どのようなものにテストを書くのか、または書かないのか）

## このインターンでの自分の目標

このインターンでは以下の目標にしていました。

- **管理のしやすいコンポーネントの設計**
- **フロントエンドでのテスト**
- **パフォーマンス**への取り組み
- CSS Framework を使わないで CSS にちょっと強くなる

## 完成したもの

- Figma のデザインカンプに必要なコンポーネント
- TOP ページ（レスポンシブ対応：PC、Tablet、Mobile）

期間内に全て完成しませんでしたが、その分開発手法やデザインの考え方を学ぶことができました。

以下に学んで良かったことを列挙します。

## 学んだこと

### 開発手法

- 今回は簡易的な git-flow を採用しました。`feature`、`master` で管理し、PR をメンターの方にレビューして頂きました。

### CSS

- ~~思ったところにいかない辛み~~
- media query
- flexbox：超便利！CSS ちょっとわかった気になる！
- relative, absolute
- object-fit：正方形画像をトリミングかリサイズするかの判断

### 設計

- **コンポーネントの切り出し**

  以下はシンプルなカードですが、フィードバックを元に正方形の画像や右側のコンテンツをコンポーネント化したり、タグとそれらをまとめたタググループのコンポーネントを作成しました。

  ![スクリーンショット 2020-11-18 9.59.19](https://user-images.githubusercontent.com/45157831/99479863-57d1c600-299a-11eb-97b0-15987dbf7fd1.png)

- **ディレクトリ管理**

  - 共通の CSS プロパティを外部に外出ししました。
    仕様変更の際は一箇所だけ変更すれば良いので、変化に強くなります。

    - media-query

      ```typescript
      export const size = (screenSize: string): string => {
        if (screenSize === "mobile") {
          return `@media (max-width: 767px)`;
        } else if (screenSize === "tablet") {
          return `@media (min-width: 768px) and (max-width: 1151px)`;
        } else if (screenSize === "mt") {
          return `@media (max-width: 1151px)`;
        } else if (screenSize === "pc") {
          return `@media (min-width: 1152px)`;
        }
      };

      export const mq = {
        mobile: size("mobile"),
        tablet: size("tablet"),
        mobileTablet: size("mt"),
        pc: size("pc"),
      };
      ```

    - max-width

      ```typescript
      export const width = (size: string): string => {
        if (size === "pc") {
          return `max-width: 1152px;`;
        } else if (size === `tablet`) {
          return `max-width: 768px;`;
        } else if (size === `mobile`) {
          return `max-width: 375px;`;
        }
      };

      export const mw = {
        pc: width("pc"),
        tablet: width("tablet"),
        mobile: width("mobile"),
      };
      ```

  - Template, Modules のようなまとまったコンポーネントを別のフォルダに管理しました。

    ![folder](https://user-images.githubusercontent.com/45157831/99767068-bdae8100-2b45-11eb-8811-80b1e6d4ca83.png)

### 静的解析

- [husky](https://github.com/typicode/husky/tree/v5.0.0)で git hook を扱い、commit の前に ESLint と Prettier が動くように設定しました。

### CI/CD

- Jenkins, Circle CI, AWS CodePipLine

![jenkince](https://tomokazu-kozuma.com/wp-content/uploads/2017/11/download.png)

- AWS Amplify

### テスト

- 現場でもフロントはテストを書くとのことでした。
  - ユニットテスト：Jest（主流）, ava（並列処理が強み）
  - E2E テスト：codecept.js（自動化）

### パフォーマンス

- 一番大事なことは**ユーザーを操作をいかに妨げないか**
  - 例. リンクにホバーした時点でデータを取ってくる（[dev to](https://dev.to/)）
- 実務だと Lazy Loading、バンドルの分割が多い
- 画像はボトルネックになりやすい
- おすすめの著書
  - [Web フロントエンド ハイパフォーマンス チューニング](https://www.amazon.co.jp/Web%E3%83%95%E3%83%AD%E3%83%B3%E3%83%88%E3%82%A8%E3%83%B3%E3%83%89-%E3%83%8F%E3%82%A4%E3%83%91%E3%83%95%E3%82%A9%E3%83%BC%E3%83%9E%E3%83%B3%E3%82%B9-%E3%83%81%E3%83%A5%E3%83%BC%E3%83%8B%E3%83%B3%E3%82%B0-%E4%B9%85%E4%BF%9D%E7%94%B0-%E5%85%89%E5%89%87/dp/4774189677)
  - [超速! Web ページ速度改善ガイド ── 使いやすさは「速さ」から始まる](https://www.amazon.co.jp/Web%E3%83%9A%E3%83%BC%E3%82%B8%E9%80%9F%E5%BA%A6%E6%94%B9%E5%96%84%E3%82%AC%E3%82%A4%E3%83%89-%E4%BD%BF%E3%81%84%E3%82%84%E3%81%99%E3%81%95%E3%81%AF%E3%80%8C%E9%80%9F%E3%81%95%E3%80%8D%E3%81%8B%E3%82%89%E5%A7%8B%E3%81%BE%E3%82%8B-WEB-PRESS-plus/dp/477419400X/ref=pd_lpo_14_t_0/358-2141100-0492308?_encoding=UTF8&pd_rd_i=477419400X&pd_rd_r=29d34a0a-29c7-43ed-85dd-d0c3ee47b6a0&pd_rd_w=X8DXq&pd_rd_wg=Q3jhU&pf_rd_p=4b55d259-ebf0-4306-905a-7762d1b93740&pf_rd_r=QEJ37MNHAPBW4T4ATKSK&psc=1&refRID=QEJ37MNHAPBW4T4ATKSK)

## 感想

- 当初の目的であった設計周りの話を**実務ベース**で学べたのが良かったです。
- 自分の知らない技術に触れられて知見が溜まりました。
- 技術だけでなく、**考え方**（コンポーネントの切り方、拡張性の高いコンポーネント・スタイリング）を知り、次へつながるモチベーションになりました。

## お礼

自分のやりたいことをどんどんやらせて頂きました。
レビューや質問などに丁寧に対応して頂いた桑原さん、人事の方、フロントエンドチームの方々に感謝します。ありがとうございました。
