---
title: "画面に表示されたことを検出して、Styled ComponentsでCSSを切り替える"
date: 2020-10-03T09:43:00+09:00
description: "react-intersection-observerとは画面の要素がビューポート（ブラウザ上に表示されている画面）に入った時、もしくは出た時に検知してくれる React 用のライブラリです。"
author: daichi
categories: ["DEV"]
tags: ["React", "styled-component", "react-intersection-observer"]
images: ["tcard/react-intersection-observer.png"]
---

## はじめに

いろいろなサイトを見ていると、画面へ入る瞬間にヌルッと下から出てくる UI を見つけました。以下のようなものです。

![ezgif.com-gif-maker.gif](https://blog.da1chi.net/posts/react-intersection-observer.gif)

> 画面に入るとヌルッとしたから出てくるものですが、GIF だと分かりづらいのでちゃんと見たい人は[**私が作成したページ**](https://kudoa-portfolio.vercel.app/)で見ることができます。

この UI が個人的に結構気に入ったので、React での実装例として共有します。

## 使用したライブラリ

- react-intersection-observer: 8.29.0
- @emotion/core: 10.0.28

## react-intersection-observer とは

[react-intersection-observer](https://github.com/thebuilder/react-intersection-observer)とは画面の要素がビューポート（ブラウザ上に表示されている画面）に入った時、もしくは出た時に検知してくれる React 用のライブラリです。内部的には[Intersection Observer API](https://developer.mozilla.org/ja/docs/Web/API/Intersection_Observer_API)が使われており、React で使いやすいように hooks などで提供してくれています。

react-intersection-observer は以下のように使用できます。

```tsx
// Usage of Hooks, useInView (TypeScript)
import React from "react";
import { useInView } from "react-intersection-observer";

const Component: React.FC = () => {
  const { ref, inView } = useInView({
    /* Optional options */
    threshold: 0,
  });

  return (
    <div ref={ref}>
      <h2>{`Header inside viewport ${inView}.`}</h2>
    </div>
  );
};
```

> [Usage Hooks 🎣 useInView](https://github.com/thebuilder/react-intersection-observer)

検知したい HTML の親要素の ref 属性に対して、useInView で提供されている `ref` を割り当てることで、ビューポートに表示されているかいないかを検知できるようになります。inView にはデフォルトは flase であり、検知すれば true を返します。これを使用して CSS を切り替えます。

## Styled Components で inView の値によって CSS を切り替える

emotion には props を受け取って CSS を切り替えられます。

```tsx
import styled from "@emotion/styled";

const Button = styled.button`
  color: ${(props) => (props.primary ? "hotpink" : "turquoise")};
`;
```

> Styled Components [Changing based on props](https://emotion.sh/docs/styled)

この機能を使うことで inView の値に応じて CSS を切り替えることができます。例えば、最初に例として挙げたビューポートに入った瞬間ヌルッとしたから出てくる UI は以下のように実現しています。

```tsx
import React from "react";
import { useInView } from "react-intersection-observer";
import styled from "@emotion/styled";

const Component: React.FC = () => {
  const { ref, inView } = useInView({
    /* Optional options */
    threshold: 0,
  });

  return (
    //　inView属性を割り当てる
    <Section ref={ref} inView={inView}>
      <h2>{`Header inside viewport ${inView}.`}</h2>
      <p>スクロールとするとヌルッと出てくるよ！</p>
    </Section>
  );
};

// inViewの型を定義
interface Props {
  inView: boolean;
}

// inViewがtrueになると透明度が0.5から1になり、50px下から移動してくる
const Section = styled.section<Props>`
  transition: all 1s ease;
  transform: ${(props) =>
    props.inView ? "translateY(0)" : "translateY(50px)"};
  opacity: ${(props) => (props.inView ? 1 : 0.5)};
`;
```

## まとめ

react-intersection-observer と Styled Components を紹介しました。ユーザーの動作に応じて CSS を切り替えると動きのある UI を実現できます。これらの機能を使用して自分の Portfolio を作成したので、ご興味があれば参考にどうぞ。

- [**Daichi Kudo's Portfolio**](https://kudoa-portfolio.vercel.app/)

他にもこれらの機能を使って面白い実装などありましたら、是非コメントで教えてください。
