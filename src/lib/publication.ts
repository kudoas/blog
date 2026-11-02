export type Publication = 'personal' | 'contribution';
export type PublicationFilter = Publication | '';

export function publicationFilter(value: string | null | undefined): PublicationFilter {
  return value === 'personal' || value === 'contribution' ? value : '';
}

export function matchesPublication(article: { publication: Publication }, filter: PublicationFilter) {
  return !filter || article.publication === filter;
}
