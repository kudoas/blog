class SearchSelection
  def initialize(repository)
    @repository = repository
    @by_id = repository.articles.index_by { |article| article.fetch("id") }
  end

  def resolve(ids:, excerpts:, query:, tag:, fallback:)
    return { articles: @repository.filter(query: query, tag: tag), excerpts: {} } if fallback

    selected_tag = normalize(tag).gsub(/\s+/, "-")
    articles = Array(ids).filter_map do |id|
      article = @by_id[id]
      next unless article
      next unless selected_tag.empty? || article.fetch("tags").any? { |value| normalize(value).gsub(/\s+/, "-") == selected_tag }

      article
    end.uniq { |article| article.fetch("id") }
    allowed_ids = articles.to_set { |article| article.fetch("id") }
    safe_excerpts = excerpts.to_h.filter_map do |id, excerpt|
      next unless allowed_ids.include?(id) && excerpt.is_a?(String)

      [id, safe_excerpt(excerpt)]
    end.to_h
    { articles: articles, excerpts: safe_excerpts }
  end

  private

  def normalize(value)
    value.to_s.unicode_normalize(:nfkc).downcase.strip
  end

  def safe_excerpt(value)
    value.gsub("<mark>", "\0").gsub("</mark>", "\1").gsub("<", "&lt;").gsub(">", "&gt;").gsub("\0", "<mark>").gsub("\1", "</mark>")
  end
end
