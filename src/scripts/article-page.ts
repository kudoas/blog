import { articleReturnLink } from '../lib/article-return';
import { pageReferrer } from './page-navigation';

const initialized = new WeakSet<Element>();
function initializeArticle() {
  const article = document.querySelector('.post');
  if (!article || initialized.has(article)) return;
  initialized.add(article);
  const toc = article.querySelector<HTMLDetailsElement>('.toc[data-long-toc]');
  if (toc && window.matchMedia('(min-width: 601px)').matches) toc.open = true;
  const first = article.querySelector<HTMLAnchorElement>('[data-return-taxonomies]');
  const taxonomies: string[] = JSON.parse(first?.dataset.returnTaxonomies ?? '[]');
  const destination = articleReturnLink(pageReferrer(), location.origin, taxonomies);
  if (destination) {
    for (const link of article.querySelectorAll<HTMLAnchorElement>('[data-article-return-link]')) {
      link.href = destination.href;
      link.textContent = `← ${destination.label}${link.dataset.articleReturnLink === 'end' ? 'へ戻る' : ''}`;
    }
  }
}

initializeArticle();
document.addEventListener('astro:after-swap', initializeArticle);
document.addEventListener('astro:page-load', initializeArticle);
