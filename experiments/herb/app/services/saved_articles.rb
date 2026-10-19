class SavedArticles
  SESSION_KEY = :saved_article_ids
  MAX_ITEMS = 20

  attr_reader :ids

  def initialize(articles:, ids: [])
    @articles_by_id = articles.index_by { |article| article.fetch("id") }
    @ids = Array(ids).select { |id| @articles_by_id.key?(id) }.uniq.first(MAX_ITEMS)
  end

  def add(id)
    return :not_found unless @articles_by_id.key?(id)
    return :already_saved if @ids.include?(id)
    return :limit_reached if @ids.length >= MAX_ITEMS

    @ids << id
    :added
  end

  def remove(id)
    return :not_saved unless @ids.delete(id)

    :removed
  end

  def articles
    @ids.filter_map { |id| @articles_by_id[id] }
  end
end
