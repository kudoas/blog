require "test_helper"

class SavedArticlesIntegrationTest < ActionDispatch::IntegrationTest
  test "adding and removing use normal HTML form redirects" do
    article_id = PublishedContent.new.articles.first.id

    post "/saved-articles", params: { article_id: article_id }
    assert_response :redirect
    assert_equal "/", URI(response.headers.fetch("location")).path

    post "/saved-articles/remove", params: { article_id: article_id }
    assert_response :redirect
    assert_equal "/", URI(response.headers.fetch("location")).path
  end

  test "invalid article ids return not found" do
    post "/saved-articles", params: { article_id: "unknown" }

    assert_response :not_found
  end

  test "the home page renders an empty saved collection and add controls" do
    get "/"

    assert_response :success
    assert_select "form[data-herb-into='saved_articles']", minimum: 1
    assert_select "ul[data-herb-name='saved_articles'] > li", 0
  end

  test "an Outbox add confirms one keyed row and persists it in the session" do
    article = PublishedContent.new.articles.first

    post "/saved-articles?format=slots", params: { article_id: article.fetch("id") },
      headers: { "Accept" => "application/vnd.herb.slots+json" }

    assert_response :created
    assert_equal "application/vnd.herb.slots+json", response.media_type
    assert_includes response.body, article.fetch("id")

    get "/"
    assert_select "ul[data-herb-name='saved_articles'] > li", 1
    assert_select "ul[data-herb-name='saved_articles'] a[href='#{article.fetch("url")}']"
    assert_select ".result-number", "21"
    assert_select ".article-list > li[data-article-id='#{article.id}']", 0
  end

  test "an Outbox add from a taxonomy page confirms against that page template" do
    article = PublishedContent.new.articles.first

    post "/saved-articles?format=slots", params: { article_id: article.fetch("id") },
      headers: {
        "Accept" => "application/vnd.herb.slots+json",
        "HTTP_REFERER" => "http://www.example.com/tags/react/"
      }

    assert_response :created
    assert_equal "app/views/taxonomies/show.html.erb", JSON.parse(response.body).fetch("template")
    assert_includes response.body, article.fetch("id")
  end

  test "removing a saved article clears it from the session" do
    article = PublishedContent.new.articles.first
    post "/saved-articles", params: { article_id: article.fetch("id") }
    post "/saved-articles/remove", params: { article_id: article.fetch("id") }

    get "/"
    assert_select "ul[data-herb-name='saved_articles'] > li", 0
    assert_select ".result-number", "22"
    assert_select ".article-list > li[data-article-id='#{article.id}']", 1
  end

  test "removing a saved article can return slots without a redirect" do
    article = PublishedContent.new.articles.first
    post "/saved-articles", params: { article_id: article.fetch("id") }

    post "/saved-articles/remove?format=slots", params: { article_id: article.fetch("id") },
      headers: { "Accept" => "application/vnd.herb.slots+json" }

    assert_response :success
    assert_equal "application/vnd.herb.slots+json", response.media_type
    assert_equal "app/views/articles/index.html.erb", JSON.parse(response.body).fetch("template")

    get "/"
    assert_select "ul[data-herb-name='saved_articles'] > li", 0
  end

  test "a full saved list explains the limit and disables further adds" do
    PublishedContent.new.articles.first(ReadingList::MAX_ITEMS).each do |article|
      post "/saved-articles", params: { article_id: article.fetch("id") }
    end

    get "/"

    assert_select ".saved-articles-limit[role='status']", "あとで読める記事は20件までです。"
    assert_select "form[data-herb-into='saved_articles'] button[disabled]", minimum: 1
  end
end
