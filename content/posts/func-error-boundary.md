---
title: "Error BoundaryをFunction Componentで扱う"
date: 2020-10-09T09:43:00+09:00
description: "React では Error Boundary という子コンポーネントツリーでエラーが発生した際にクラッシュした UI を表示させる代わりに、フォールバック用の UI を表示するコンポーネントがあります。"
categories: ["development"]
tags: ["react", "error-boundary"]
images: ["tcard/func-error-boundary.png"]
author: ["@kudoadd"]
---

## 要約

- React では v16 から React Hooks の登場で Function Component がスタンダードになっている
- Error Boundary を実装する際はライフサイクルメソッドの `static getDerivedStateFromError()` か `componentDidCatch()` のいずれか（または両方）を使わないといけない、つまり Class Component が必須になっている
- [react-error-boundar](https://github.com/bvaughn/react-error-boundary)では Error Boundary を Function Component で扱えるラッパーを提供してくれる

## Error Boundary とは

React では Error Boundary という子コンポーネントツリーでエラーが発生した際にクラッシュした UI を表示させる代わりに、フォールバック用の UI を表示するコンポーネントがあります。これはユーザーが壊れた画面で操作することにより、サービスに問題が起こることを防ぐことができます。

このようなエラーハンドリングは `try/catch` で行うことが一般的ですが、これは命令型のコード（関数の実行など）でしか動作しません。そのため、コンポーネントのような宣言型でエラーに応じた処理を行うためには別の方法を取らなければなりません。react ではライフサイクルメソッドの [`static getDerivedStateFromError()`](https://ja.reactjs.org/docs/react-component.html#static-getderivedstatefromerror) か [`componentDidCatch()`](https://ja.reactjs.org/docs/react-component.html#componentdidcatch) のいずれか（または両方）を使うことで実装できます。

以下は公式ドキュメントからの抜粋です。

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    logErrorToMyService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children; 
  }
}
```

```jsx
// 使い方
<ErrorBoundary>
  <MyWidget />
</ErrorBoundary>
```

> [error boundaryとは](https://ja.reactjs.org/docs/error-boundaries.html#introducing-error-boundaries)

これらを関数型でうまく扱える方法がないか探したところ、`react-error-boundary`というパッケージがありました。
なので実装例とともに紹介します。

## Function Component で Error Boundary を試す

[react-error-boundary](https://github.com/bvaughn/react-error-boundary)というレンダリング時のエラーを扱いやすくするラッパーを提供してくれています。
試しに定期的にエラーを引き起こすコンポーネントを作成します。

```tsx
import React from "react";
import ReactDOM from "react-dom";

// 定期的にエラーを起こすコンポーネント
const App: React.FC = () => {
  const rnd = Math.random();
  if (rnd <= 0.7) {
    throw new Error("Something went wrong!");
  }
  return <div>OK</div>;
};

ReactDOM.render(
  <App />,
  document.getElementById("root")
);
```

現状のままだと `<App />` がエラーを出した場合、真っ白な画面（壊れた UI）が表示されてしまいます。

`react-error-boundary`を使うことでエラー時のコンポーネントを関数コンポーネントとして別に用意し、エラー時のフォールバック用のコンポーネントとして表示できます。以下が簡単な実装例です。

```jsx
import React from "react";
import ReactDOM from "react-dom";

import { ErrorBoundary, FallbackProps } from "react-error-boundary";

// 定期的にエラーを起こすコンポーネント
const App: React.FC = () => {
  const rnd = Math.random();
  if (rnd <= 0.7) {
    throw new Error("Something went wrong!");
  }
  return <div>OK</div>;
};

// エラー時のフォールバック用のコンポーネント
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div role="alert">
      <p>Error Message</p>
      <pre>{error!.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
};

ReactDOM.render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
  </ErrorBoundary>,
  document.getElementById("root")
);
```

これによりエラーの際に、`<ErrorFallback/>`で定義した代わりの UI を表示させることができます。

![error-message](https://kudolog.net/posts/func-error-boundary1.png)

より詳しく知りたい方は参考資料をご覧ください。

## 参考資料

- [Error Boundary](https://ja.reactjs.org/docs/error-boundaries.html) 
- [react-error-boundary](https://github.com/bvaughn/react-error-boundary)

