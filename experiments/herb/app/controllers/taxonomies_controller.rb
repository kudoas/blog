class TaxonomiesController < ApplicationController
  def tags
    @terms = published_content.terms(:tags)
    @page_title = "タグ"
    @heading = "タグから探す"
    @eyebrow = "TOPICS"
    @subtitle = "気になるテーマの記事をまとめて。"
    @base_path = "/tags/"
    render :index
  end

  def categories
    @terms = published_content.terms(:categories)
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
    @saved_articles = reading_list.articles
    term = published_content.terms(field).find { |item| item.fetch("slug") == params[:term] }
    raise ActionController::RoutingError, "Not Found" unless term

    @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
    @page_title = @heading
    @base_path = base_path
    @articles = published_content.tagged(field: field, slug: params[:term])
    render :show
  end
end
