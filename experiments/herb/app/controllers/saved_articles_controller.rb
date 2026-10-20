class SavedArticlesController < ApplicationController
  def create
    id = params[:article_id].presence || params.dig(:article, :article_id).to_s
    result = reading_list.add(id)
    persist_reading_list

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
    result = reading_list.remove(params[:article_id].to_s)
    persist_reading_list

    respond_to do |format|
      format.slots { render_slots_after_removal }
      format.html { redirect_back_or_to root_path, notice: notice_for(result) }
    end
  end

  private

  def persist_reading_list
    session[READING_LIST_SESSION_KEY] = reading_list.ids
  end

  def render_slots_confirmation(id)
    @saved_articles = [published_content.article(id)]
    referer_path = URI.parse(request.referer.to_s).path
    taxonomy = %r{\A/(tags|categories)/([a-z0-9-]+)/?\z}.match(referer_path)

    if taxonomy && render_taxonomy_confirmation(taxonomy)
      render "taxonomies/show", status: :created
    else
      @query = ""
      @tag = ""
      @total_count = published_content.articles.length
      @articles = published_content.articles
      @excerpts = {}
      render "articles/index", status: :created
    end
  rescue URI::InvalidURIError
    @query = ""
    @tag = ""
    @total_count = published_content.articles.length
    @articles = published_content.articles
    @excerpts = {}
    render "articles/index", status: :created
  end

  def render_slots_after_removal
    @saved_articles = reading_list.articles
    referer_path = URI.parse(request.referer.to_s).path
    taxonomy = %r{\A/(tags|categories)/([a-z0-9-]+)/?\z}.match(referer_path)

    if taxonomy && render_taxonomy_confirmation(taxonomy)
      render "taxonomies/show"
    else
      @query = params[:q].to_s
      @tag = params[:tag].to_s
      @total_count = published_content.articles.length
      result = SearchResult.from_pagefind(content: published_content, ids: params[:ids],
        excerpts: params[:excerpts].is_a?(ActionController::Parameters) ? params[:excerpts].to_unsafe_h : {}, tag: @tag)
      @articles = result.articles
      @excerpts = result.excerpts
      render "articles/index"
    end
  rescue URI::InvalidURIError
    @query = ""
    @tag = ""
    @total_count = published_content.articles.length
    @articles = published_content.articles
    @excerpts = {}
    render "articles/index"
  end

  def render_taxonomy_confirmation(taxonomy)
    kind, slug = taxonomy.captures
    field = kind == "tags" ? :tags : :categories
    term = published_content.terms(field).find { |item| item.fetch("slug") == slug }
    return false unless term

    @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
    @page_title = @heading
    @base_path = "/#{kind}/"
    @articles = published_content.tagged(field: field, slug: slug)
  end

  def notice_for(result)
    case result
    when :added then "あとで読むに追加しました。"
    when :already_saved then "この記事はすでに保存されています。"
    when :limit_reached then "あとで読める記事は#{ReadingList::MAX_ITEMS}件までです。"
    when :removed then "あとで読むから解除しました。"
    else "この記事は保存されていません。"
    end
  end
end
