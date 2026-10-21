class ArticlesController < ApplicationController
  def index
    @saved_articles = @reading_list.articles
    @articles = @published_content.articles
  end
end
