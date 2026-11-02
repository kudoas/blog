import { useEffect, useRef, useState } from 'react';
import { collectTerms, filterArticles, normalizeText } from '../lib/articles';
import type { ArticleSummary } from '../lib/articles';
import { searchArticles } from '../lib/search';
import type { SearchHit } from '../lib/search';
import ArticleList from './ArticleList';
import { matchesPublication, publicationFilter, type PublicationFilter } from '../lib/publication';

interface SearchState { query: string; tag: string; publication: PublicationFilter }
interface SearchResult extends SearchState { hits: SearchHit[]; failed: boolean }

export default function ArticleExplorer({ articles }: { articles: ArticleSummary[] }) {
  const searchInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<SearchState>({ query: '', tag: '', publication: '' });
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<SearchResult>(() => ({
    query: '', tag: '', publication: '', hits: articles.map((article) => ({ article, excerpt: '' })), failed: false,
  }));
  const tags = collectTerms(articles);
  const fullText = !import.meta.env.DEV && Boolean(normalizeText(state.query));
  const current = result?.query === state.query && result.tag === state.tag && result.publication === state.publication ? result : null;
  const busy = ready && fullText && (composing || !current);
  const fallback = !fullText || current?.failed;
  const displayed = current ?? result;
  const visible = fallback ? filterArticles(articles, state.query, state.tag, state.publication) : displayed.hits.map(({ article }) => article).filter(article => matchesPublication(article, state.publication));
  const excerpts = !fallback ? Object.fromEntries(displayed.hits.map(({ article, excerpt }) => [article.id, excerpt])) : {};
  const active = Boolean(state.query || state.tag || state.publication);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setState({ query: params.get('q') ?? '', tag: params.get('tag') ?? '', publication: publicationFilter(params.get('publication')) });
    };
    restore();
    setReady(true);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    if (!ready || composing) return;
    if (!fullText) {
      setResult({ ...state, hits: filterArticles(articles, state.query, state.tag, state.publication).map((article) => ({ article, excerpt: '' })), failed: false });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchArticles(articles, state.query, state.tag, state.publication);
        if (!cancelled) setResult({ ...state, hits, failed: false });
      } catch {
        if (!cancelled) setResult({ ...state, hits: filterArticles(articles, state.query, state.tag, state.publication).map((article) => ({ article, excerpt: '' })), failed: true });
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [articles, state.query, state.tag, state.publication, ready, fullText, composing]);

  useEffect(() => {
    if (ready && window.location.hash === '#article-search') searchInput.current?.focus();
  }, [ready]);

  function update(next: SearchState) {
    setState(next);
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', next.query], ['tag', next.tag], ['publication', next.publication]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className="article-explorer">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={!ready} className="publication-filter">
          <legend className="sr-only">記事の分類</legend>
          {([['', 'すべて'], ['personal', '個人記事'], ['contribution', '寄稿記事']] as const).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="publication" value={value} checked={state.publication === value}
                onChange={() => update({ ...state, publication: value })} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset disabled={!ready} className="search-fields">
          <legend className="sr-only">記事を探す</legend>
          <div className="search-input">
            <label htmlFor="article-search" className="sr-only">記事を検索</label>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input ref={searchInput} id="article-search" type="search" placeholder="記事を検索" aria-describedby="search-help" value={state.query}
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
        {active && <button type="button" className="clear-search" onClick={() => { update({ query: '', tag: '', publication: '' }); searchInput.current?.focus(); }}>条件をクリア</button>}
      </div>
      <div aria-busy={busy}>
        {busy && <p className="search-help">検索中は変更前の一覧を表示しています。</p>}
        {visible.length > 0 ? <ArticleList articles={visible} excerpts={excerpts} /> : <p className="empty-state">{busy ? '変更前の条件に合う記事はありません。' : '条件に合う記事が見つかりませんでした。'}</p>}
      </div>
    </div>
  );
}
