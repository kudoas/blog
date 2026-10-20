class ApplicationController < ActionController::Base
  READING_LIST_SESSION_KEY = :saved_article_ids

  helper_method :published_content

  private

  def published_content
    @published_content ||= PublishedContent.new
  end

  def reading_list
    @reading_list ||= ReadingList.new(content: published_content, ids: session[READING_LIST_SESSION_KEY])
  end

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes
end
