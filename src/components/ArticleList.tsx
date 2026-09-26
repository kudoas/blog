import { formatDate, tagUrl } from '../lib/articles';
import type { ArticleSummary } from '../lib/articles';

export default function ArticleList({ articles }: { articles: ArticleSummary[] }) {
  return (
    <ul className="article-list">
      {articles.map((article) => (
        <li key={article.id}>
          <article className="article-summary">
            <time className="article-date" dateTime={article.date}>{formatDate(article.date)}</time>
            <div className="article-summary-content">
              <h3>
                <a href={article.url} {...(article.kind === 'external' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {article.title}
                  {article.kind === 'external' && <span className="external-arrow" aria-label="外部サイトを新しいタブで開く">↗</span>}
                </a>
              </h3>
              <div className="article-meta">
                <span className={article.kind === 'external' ? 'article-source' : 'article-source local-source'}>{article.source}</span>
                {article.draft && <span className="draft-label">下書き</span>}
                {article.tags.map((tag) => <a className="tag" href={tagUrl(tag)} key={tag}>#{tag}</a>)}
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
