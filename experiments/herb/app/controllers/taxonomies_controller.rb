class TaxonomiesController < ApplicationController
  def tags
    @terms = content_repository.terms(:tags)
    @page_title = "タグ"
    @heading = "タグから探す"
    @eyebrow = "TOPICS"
    @subtitle = "気になるテーマの記事をまとめて。"
    @base_path = "/tags/"
    render :index
  end

  def categories
    @terms = content_repository.terms(:categories)
    @page_title = "カテゴリ"
    @heading = "カテゴリから探す"
    @eyebrow = "CATEGORIES"
    @subtitle = "カテゴリ別の記事一覧。"
    @base_path = "/categories/"
    render :index
  end

  def tag
    render_term(:tags, "/tags/")
  end

  def category
    render_term(:categories, "/categories/")
  end

  private

  def render_term(field, base_path)
    @saved_articles = SavedArticles.new(articles: content_repository.articles, ids: session[SavedArticles::SESSION_KEY]).articles
    term = content_repository.terms(field).find { |item| item.fetch("slug") == params[:term] }
    raise ActionController::RoutingError, "Not Found" unless term

    @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
    @page_title = @heading
    @base_path = base_path
    @articles = content_repository.articles.select do |article|
      article.fetch(field.to_s).any? { |value| helpers.tag_slug(value) == params[:term] }
    end
    render :show
  end
end
