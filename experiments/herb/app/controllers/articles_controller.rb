class ArticlesController < ApplicationController
  def index
    @saved_articles = @reading_list.articles
    @articles = @reading_list.unsaved_articles(@published_content.articles)
  end
end
