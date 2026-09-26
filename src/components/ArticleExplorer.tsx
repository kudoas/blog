import { useEffect, useState } from 'react';
import { collectTerms, filterArticles, normalizeText } from '../lib/articles';
import type { ArticleSummary } from '../lib/articles';
import { searchArticles } from '../lib/search';
import type { SearchHit } from '../lib/search';
import ArticleList from './ArticleList';

interface SearchState { query: string; tag: string }
interface SearchResult extends SearchState { hits: SearchHit[]; failed: boolean }

export default function ArticleExplorer({ articles }: { articles: ArticleSummary[] }) {
  const [state, setState] = useState<SearchState>({ query: '', tag: '' });
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const tags = collectTerms(articles);
  const fullText = !import.meta.env.DEV && Boolean(normalizeText(state.query));
  const current = result?.query === state.query && result.tag === state.tag ? result : null;
  const busy = ready && fullText && (composing || !current);
  const fallback = !fullText || current?.failed;
  const visible = fallback ? filterArticles(articles, state.query, state.tag) : current?.hits.map(({ article }) => article) ?? [];
  const excerpts = !fallback && current ? Object.fromEntries(current.hits.map(({ article, excerpt }) => [article.id, excerpt])) : {};
  const active = Boolean(state.query || state.tag);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setState({ query: params.get('q') ?? '', tag: params.get('tag') ?? '' });
    };
    restore();
    setReady(true);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    if (!ready || !fullText || composing) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchArticles(articles, state.query, state.tag);
        if (!cancelled) setResult({ ...state, hits, failed: false });
      } catch {
        if (!cancelled) setResult({ ...state, hits: [], failed: true });
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [articles, state.query, state.tag, ready, fullText, composing]);

  function update(next: SearchState) {
    setState(next);
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', next.query], ['tag', next.tag]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className="article-explorer">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={!ready} className="search-fields">
          <legend className="sr-only">記事を探す</legend>
          <div className="search-input">
            <label htmlFor="article-search" className="sr-only">記事を検索</label>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input id="article-search" type="search" placeholder="記事を検索" aria-describedby="search-help" value={state.query}
              onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
              onChange={(event) => update({ ...state, query: event.target.value })} />
          </div>
          <label htmlFor="tag-filter" className="sr-only">タグで絞り込む</label>
          <select id="tag-filter" value={state.tag} onChange={(event) => update({ ...state, tag: event.target.value })}>
            <option value="">すべてのタグ</option>
            {state.tag && !tags.some(({ slug }) => slug === state.tag) && <option value={state.tag}>{state.tag}</option>}
            {tags.map(({ slug, label }) => <option value={slug} key={slug}>{label}</option>)}
          </select>
        </fieldset>
      </form>
      <p id="search-help" className="search-help">{import.meta.env.DEV ? 'タイトル・タグから検索します。' : 'ブログ内は本文まで、外部記事はタイトル・タグ・説明を検索します。'}</p>
      {fullText && current?.failed && <p className="search-help" role="alert">本文検索を読み込めませんでした。タイトル・タグから検索しています。</p>}
      <div className="list-status">
        <p role="status" aria-live="polite" aria-atomic="true">{busy ? '検索中…' : <><span className="result-number">{visible.length}</span> 件の記事{active && ` / 全${articles.length}件`}</>}</p>
        {active && <button type="button" className="clear-search" onClick={() => update({ query: '', tag: '' })}>条件をクリア</button>}
      </div>
      <div aria-busy={busy}>
        {!busy && (visible.length > 0 ? <ArticleList articles={visible} excerpts={excerpts} /> : <p className="empty-state">条件に合う記事が見つかりませんでした。</p>)}
      </div>
    </div>
  );
}
