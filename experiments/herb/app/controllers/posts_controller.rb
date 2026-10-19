class PostsController < ApplicationController
  def show
    @post = content_repository.find_post(params[:slug])
    raise ActionController::RoutingError, "Not Found" unless @post

    @page_title = @post.fetch("title")
    @description = @post.fetch("description")
    @image = @post.fetch("images").first
    @article = true
    @published_at = @post.fetch("date")
  end
end
