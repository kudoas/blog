class ArticlesController < ApplicationController
  def index
    @saved_articles = reading_list.articles
    @query = params[:q].to_s
    @tag = params[:tag].to_s
    @total_count = published_content.articles.length
    if request.post?
      result = if params[:fallback] == true
        SearchResult.fallback(content: published_content, query: @query, tag: @tag)
      else
        SearchResult.from_pagefind(content: published_content, ids: params[:ids],
          excerpts: params[:excerpts].is_a?(ActionController::Parameters) ? params[:excerpts].to_unsafe_h : {}, tag: @tag)
      end
      @articles = result.articles
      @excerpts = result.excerpts
    else
      @articles = published_content.search(query: @query, tag: @tag)
      @excerpts = {}
    end
    render :index if request.post?
  end
end
