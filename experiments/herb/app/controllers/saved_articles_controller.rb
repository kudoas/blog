class SavedArticlesController < ApplicationController
  def create
    id = params[:article_id].presence || params.dig(:article, :article_id).to_s
    result = saved_articles.add(id)
    persist_saved_articles

    respond_to do |format|
      format.slots do
        return head :not_found if result == :not_found
        return head :unprocessable_entity if result == :limit_reached

        render_slots_confirmation(id)
      end
      format.html do
        return head :not_found if result == :not_found

        redirect_back_or_to root_path, notice: notice_for(result)
      end
    end
  end

  def destroy
    result = saved_articles.remove(params[:article_id].to_s)
    persist_saved_articles

    redirect_back_or_to root_path, notice: notice_for(result)
  end

  private

  def saved_articles
    @saved_articles ||= SavedArticles.new(articles: content_repository.articles, ids: session[SavedArticles::SESSION_KEY])
  end

  def persist_saved_articles
    session[SavedArticles::SESSION_KEY] = saved_articles.ids
  end

  def render_slots_confirmation(id)
    @saved_articles = [content_repository.articles.find { |item| item.fetch("id") == id }]
    referer_path = URI.parse(request.referer.to_s).path
    taxonomy = %r{\A/(tags|categories)/([a-z0-9-]+)/?\z}.match(referer_path)

    if taxonomy && render_taxonomy_confirmation(taxonomy)
      render "taxonomies/show", status: :created
    else
      @query = ""
      @tag = ""
      @total_count = content_repository.articles.length
      @articles = content_repository.articles
      @excerpts = {}
      render "articles/index", status: :created
    end
  rescue URI::InvalidURIError
    @query = ""
    @tag = ""
    @total_count = content_repository.articles.length
    @articles = content_repository.articles
    @excerpts = {}
    render "articles/index", status: :created
  end

  def render_taxonomy_confirmation(taxonomy)
    kind, slug = taxonomy.captures
    field = kind == "tags" ? :tags : :categories
    term = content_repository.terms(field).find { |item| item.fetch("slug") == slug }
    return false unless term

    @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
    @page_title = @heading
    @base_path = "/#{kind}/"
    @articles = content_repository.articles.select do |article|
      article.fetch(field.to_s).any? { |value| helpers.tag_slug(value) == slug }
    end
  end

  def notice_for(result)
    case result
    when :added then "あとで読むに追加しました。"
    when :already_saved then "この記事はすでに保存されています。"
    when :limit_reached then "あとで読める記事は#{SavedArticles::MAX_ITEMS}件までです。"
    when :removed then "あとで読むから解除しました。"
    else "この記事は保存されていません。"
    end
  end
end
