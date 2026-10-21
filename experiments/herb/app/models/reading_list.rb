class ReadingList
  MAX_ITEMS = 20

  attr_reader :ids

  def initialize(content:, ids: [])
    @content = content
    @ids = Array(ids).select { |id| @content.article(id) }.uniq.first(MAX_ITEMS)
  end

  def add(id)
    return :not_found unless @content.article(id)
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
    @ids.filter_map { |id| @content.article(id) }
  end

  def unsaved_articles(articles)
    articles.reject { |article| @ids.include?(article.id) }
  end
end
