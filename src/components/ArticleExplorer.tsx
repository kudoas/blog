import { useEffect, useState } from 'react';
import { collectTerms, filterArticles } from '../lib/articles';
import type { ArticleSummary } from '../lib/articles';
import ArticleList from './ArticleList';

interface SearchState { query: string; tag: string }

export default function ArticleExplorer({ articles }: { articles: ArticleSummary[] }) {
  const [state, setState] = useState<SearchState>({ query: '', tag: '' });
  const [ready, setReady] = useState(false);
  const tags = collectTerms(articles);
  const visible = filterArticles(articles, state.query, state.tag);
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
            <label htmlFor="article-search" className="sr-only">タイトル・タグで検索</label>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input id="article-search" type="search" placeholder="タイトル・タグで検索" value={state.query} onChange={(event) => update({ ...state, query: event.target.value })} />
          </div>
          <label htmlFor="tag-filter" className="sr-only">タグで絞り込む</label>
          <select id="tag-filter" value={state.tag} onChange={(event) => update({ ...state, tag: event.target.value })}>
            <option value="">すべてのタグ</option>
            {state.tag && !tags.some(({ slug }) => slug === state.tag) && <option value={state.tag}>{state.tag}</option>}
            {tags.map(({ slug, label }) => <option value={slug} key={slug}>{label}</option>)}
          </select>
        </fieldset>
      </form>
      <div className="list-status">
        <p role="status" aria-live="polite" aria-atomic="true"><span className="result-number">{visible.length}</span> 件の記事{active && ` / 全${articles.length}件`}</p>
        {active && <button type="button" className="clear-search" onClick={() => update({ query: '', tag: '' })}>条件をクリア</button>}
      </div>
      {visible.length > 0 ? <ArticleList articles={visible} /> : <p className="empty-state">条件に合う記事が見つかりませんでした。</p>}
    </div>
  );
}
