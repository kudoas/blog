class SavedArticlesController < ApplicationController
  def create
    id = params[:article_id].presence || params.dig(:article, :article_id).to_s
    result = @reading_list.add(id)
    session[READING_LIST_SESSION_KEY] = @reading_list.ids

    respond_to do |format|
      format.slots do
        return head :not_found if result == :not_found
        return head :unprocessable_entity if result == :limit_reached

        @saved_articles = [@published_content.article(id)]
        referer_path = begin
          URI.parse(request.referer.to_s).path
        rescue URI::InvalidURIError
          ""
        end
        taxonomy = %r{\A/(tags|categories)/([a-z0-9-]+)/?\z}.match(referer_path)
        term = if taxonomy
          kind, slug = taxonomy.captures
          field = kind == "tags" ? :tags : :categories
          @published_content.terms(field).find { |item| item.fetch("slug") == slug }
        end

        if term
          @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
          @page_title = @heading
          @base_path = "/#{kind}/"
          @articles = @published_content.tagged(field: field, slug: slug)
          render "taxonomies/show", status: :created
        else
          @articles = @published_content.articles
          render "articles/index", status: :created
        end
      end
      format.html do
        return head :not_found if result == :not_found

        notice = case result
        when :added then "あとで読むに追加しました。"
        when :already_saved then "この記事はすでに保存されています。"
        when :limit_reached then "あとで読める記事は#{ReadingList::MAX_ITEMS}件までです。"
        else "この記事は保存されていません。"
        end
        redirect_back_or_to root_path, notice: notice
      end
    end
  end

  def destroy
    result = @reading_list.remove(params[:article_id].to_s)
    session[READING_LIST_SESSION_KEY] = @reading_list.ids

    respond_to do |format|
      format.slots do
        @saved_articles = @reading_list.articles
        referer_path = begin
          URI.parse(request.referer.to_s).path
        rescue URI::InvalidURIError
          ""
        end
        taxonomy = %r{\A/(tags|categories)/([a-z0-9-]+)/?\z}.match(referer_path)
        term = if taxonomy
          kind, slug = taxonomy.captures
          field = kind == "tags" ? :tags : :categories
          @published_content.terms(field).find { |item| item.fetch("slug") == slug }
        end

        if term
          @heading = field == :tags ? "##{term.fetch('label')}" : term.fetch("label")
          @page_title = @heading
          @base_path = "/#{kind}/"
          @articles = @published_content.tagged(field: field, slug: slug)
          render "taxonomies/show"
        else
          @articles = @published_content.articles
          render "articles/index"
        end
      end
      format.html do
        notice = result == :removed ? "あとで読むから解除しました。" : "この記事は保存されていません。"
        redirect_back_or_to root_path, notice: notice
      end
    end
  end
end
