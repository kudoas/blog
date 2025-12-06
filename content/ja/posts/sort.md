---
title: Pythonでのソートアルゴリズムの実装
date: 2020-06-01T09:43:00+09:00
description: "JavaSctipt 特有の非同期処理でのメモです。"
categories: ["DEV"]
tags: ["algorithm"]
images: ["tcard/sort.png"]
---

以前の面接のコーディング試験で配列ソートの課題がでました。
競技プログラミングで何度もソートはしたものの標準ライブラリで行っていたため、実際のアルゴリズムは分かっていませんでした。

なので今回は基本的な３つのソートについて Python で実装してみました。

## バブルソート

配列の一番左の値を取ってきて右隣のものと比較し、右隣の方が小さければ交換します。
この作業を配列の長さ分行えば、全てソートされるので計算量は O(n^2)かかります。

### Python での実装例

```python
def bubble_sort(A):
    n = len(A)
    for _ in range(n):
		for i in range(n-1):
            if A[i] > A[i+1]:
                A[i], A[i+1] = A[i+1], A[i]
    return A

# example
A = [2,3,4,1,5]
sorted_A = bubble_sort(A) # [1,2,3,4,5]
```

## 挿入ソート

ソート済みの区間に対して未ソート区間から数を差し込んでいきます。

### Python での実装例

```python
def insertion_sort(A):
    n = len(A)
    # i：未ソートの先頭のindex
    for i in range(n):
        # v：未ソートの先頭の配列の数
        v = A[i]
        # j：ソート済みの配列からvを差し込む位置を探すループ変数
        j = i - 1
        while j >= 0 and A[j] > v:
            A[j+1] = A[j]
            j -= 1
            A[j+1] = v
    return A
```

## 選択ソート

それぞれの区間から最小値を見つけて順番に交換していくソートです。割と直感的なアルゴリズムで分かりやすいです。

### Python での実装例

```python
n = int(input())
A = list(map(int, input().split()))
cnt = 0
def selection_sort(A):
    n = len(A)
    for i in range(n):
        min_j = i
        for j in range(i, n):
            if A[j] < A[min_j]:
                min_j = j
            if i != min_j:
                A[i], A[min_j] = A[min_j], A[i]
    return A
```

他にもクイックソートやシェルソートなどのたくさん種類があるらしいです。
ソートはアルゴリズムの**キ**らしいので、しっかり実装できるようにしたいです。
