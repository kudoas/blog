interface ArticleReturnLink { href: string; label: string }

export function articleReturnLink(referrer: string, origin: string, taxonomyPaths: readonly string[]): ArticleReturnLink | null {
  let url: URL;
  try { url = new URL(referrer); } catch { return null; }
  if (url.origin !== origin || url.username || url.password) return null;

  if (url.pathname === '/') {
    const params = new URLSearchParams();
    for (const key of ['q', 'tag']) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }
    return params.size ? { href: `/?${params}`, label: '検索結果' } : null;
  }
  if (!taxonomyPaths.includes(url.pathname)) return null;
  return { href: url.pathname, label: url.pathname.startsWith('/tags/') ? 'タグの記事一覧' : 'カテゴリの記事一覧' };
}
