class ApplicationController < ActionController::Base
  READING_LIST_SESSION_KEY = :saved_article_ids

  before_action do
    @published_content = PublishedContent.new
    @reading_list = ReadingList.new(content: @published_content, ids: session[READING_LIST_SESSION_KEY])
  end

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes
end
