class ArticlesController < ApplicationController
  def index
    @query = params[:q].to_s
    @tag = params[:tag].to_s
    @total_count = content_repository.articles.length
    if request.post?
      selection = SearchSelection.new(content_repository).resolve(
        ids: params[:ids],
        excerpts: params[:excerpts].is_a?(ActionController::Parameters) ? params[:excerpts].to_unsafe_h : {},
        query: @query,
        tag: @tag,
        fallback: params[:fallback] == true
      )
      @articles = selection.fetch(:articles)
      @excerpts = selection.fetch(:excerpts)
    else
      @articles = content_repository.filter(query: @query, tag: @tag)
      @excerpts = {}
    end
    render :index if request.post?
  end
end
