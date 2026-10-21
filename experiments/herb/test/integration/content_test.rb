require "test_helper"

class ContentTest < ActionDispatch::IntegrationTest
  test "home lists all published local and external articles" do
    get "/"

    assert_response :success
    assert_select ".article-list > li", 22
    assert_select "a[href='/posts/func-error-boundary/']", 1
    assert_select "a[href^='https://zenn.dev/']"
  end

  test "scoped article-list styles are transformed and attached to partial markup" do
    get "/"

    assert_response :success
    style = css_select("style[data-herb-style-scoped]").first
    assert style, "expected the scoped-style visitor to transform the article-list block"
    scope = style["data-herb-style-scoped"]
    assert_match(/\Adata-herb-scope-[a-f0-9]+\z/, scope)
    assert_select ".read-later-form[#{scope}]"
    assert_includes style.text, ".read-later-form[#{scope}]"
  end

  test "post preserves the canonical URL, body and heading anchors" do
    get "/posts/func-error-boundary/"

    assert_response :success
    assert_select "h1[data-pagefind-body]", "Error BoundaryをFunction Componentで扱う"
    assert_select ".prose[data-pagefind-body] pre code"
    assert_select "link[rel='canonical'][href='https://blog.da1chi.net/posts/func-error-boundary/']"
  end

  test "unknown post returns 404" do
    get "/posts/missing/"

    assert_response :not_found
  end

  test "tag and category pages use the existing paths" do
    get "/tags/"
    assert_response :success
    assert_select "a[href='/tags/react/']"

    get "/tags/react/"
    assert_response :success
    assert_select ".article-list > li", minimum: 1

    get "/categories/dev/"
    assert_response :success
    assert_select ".article-list > li", minimum: 1
  end

  test "home page shows the client slot example without search controls" do
    get "/"

    assert_response :success
    assert_select "button[data-herb-toggle='show_slots_example']", "Slots の仕組みを見る"
    assert_select "form[role='search']", 0
  end

  test "article index returns a Herb slots payload" do
    get "/", params: { format: :slots },
      headers: { "Accept" => "application/vnd.herb.slots+json" }

    assert_response :success
    assert_equal "application/vnd.herb.slots+json", response.media_type
    payload = JSON.parse(response.body)
    assert_equal "app/views/articles/index.html.erb", payload.fetch("template")
    assert payload.fetch("slots").any?
  end

  test "serves legacy images, feeds and the Pagefind search index" do
    get "/images/header/background.jpg"
    assert_response :success
    assert_equal "image/jpeg", response.media_type

    get "/index.xml"
    assert_response :success
    assert_includes response.body, "<rss"

    get "/pagefind/pagefind.js"
    assert_response :success
    assert_includes response.media_type, "javascript"
  end

  test "applies every legacy redirect rule and preserves query strings" do
    {
      "/posts?page=2" => ["/?page=2", "page=2"],
      "/posts/index.xml?x=1" => ["/index.xml?x=1", "x=1"],
      "/about?from=legacy" => ["https://da1chi.net?from=legacy", ""],
      "/series/" => ["/tags/", ""],
      "/sitemap.xml" => ["/sitemap-index.xml", ""],
      "/posts/page/3/" => ["/", ""],
      "/tags/react/page/2/" => ["/tags/react/", ""],
      "/categories/dev/page/4/" => ["/categories/dev/", ""],
    }.each do |path, (location, _query)|
      get path
      assert_response :moved_permanently
      assert_equal location, response.headers.fetch("location")
    end
  end
end
