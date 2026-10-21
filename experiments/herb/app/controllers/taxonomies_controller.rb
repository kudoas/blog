class TaxonomiesController < ApplicationController
  def tags
    @terms = @published_content.terms(:tags)
    @page_title = "タグ"
    @heading = "タグから探す"
    @eyebrow = "TOPICS"
    @subtitle = "気になるテーマの記事をまとめて。"
    @base_path = "/tags/"
    render :index
  end

  def categories
    @terms = @published_content.terms(:categories)
    @page_title = "カテゴリ"
    @heading = "カテゴリから探す"
    @eyebrow = "CATEGORIES"
    @subtitle = "カテゴリ別の記事一覧。"
    @base_path = "/categories/"
    render :index
  end

  def tag
    @saved_articles = @reading_list.articles
    term = @published_content.terms(:tags).find { |item| item.fetch("slug") == params[:term] }
    raise ActionController::RoutingError, "Not Found" unless term

    @heading = "##{term.fetch('label')}"
    @page_title = @heading
    @base_path = "/tags/"
    @articles = @reading_list.unsaved_articles(@published_content.tagged(field: :tags, slug: params[:term]))
    render :show
  end

  def category
    @saved_articles = @reading_list.articles
    term = @published_content.terms(:categories).find { |item| item.fetch("slug") == params[:term] }
    raise ActionController::RoutingError, "Not Found" unless term

    @heading = term.fetch("label")
    @page_title = @heading
    @base_path = "/categories/"
    @articles = @reading_list.unsaved_articles(@published_content.tagged(field: :categories, slug: params[:term]))
    render :show
  end
end
