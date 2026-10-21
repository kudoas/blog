class SearchResult
  attr_reader :articles, :excerpts

  def self.from_pagefind(content:, ids:, excerpts:, tag:)
    articles = Array(ids).filter_map { |id| content.article(id) }.select { |article| article.tagged?(tag) }.uniq(&:id)
    allowed_ids = articles.to_set(&:id)
    safe_excerpts = excerpts.to_h.filter_map do |id, excerpt|
      next unless allowed_ids.include?(id) && excerpt.is_a?(String)

      safe = excerpt.gsub("<mark>", "\0").gsub("</mark>", "\1").gsub("<", "&lt;").gsub(">", "&gt;").gsub("\0", "<mark>").gsub("\1", "</mark>")
      [id, safe]
    end.to_h
    new(articles: articles, excerpts: safe_excerpts)
  end

  def self.fallback(content:, query:, tag:)
    new(articles: content.search(query: query, tag: tag), excerpts: {})
  end

  def initialize(articles:, excerpts:)
    @articles = articles
    @excerpts = excerpts
  end

end
