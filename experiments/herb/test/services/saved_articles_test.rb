require "test_helper"

class SavedArticlesTest < ActiveSupport::TestCase
  setup do
    @articles = ContentRepository.new.articles
    @saved = SavedArticles.new(articles: @articles, ids: [])
  end

  test "adds a published article once" do
    id = @articles.first.fetch("id")

    assert_equal :added, @saved.add(id)
    assert_equal :already_saved, @saved.add(id)
    assert_equal [id], @saved.ids
  end

  test "rejects an unknown article id" do
    assert_equal :not_found, @saved.add("unknown")
    assert_empty @saved.ids
  end

  test "drops stale ids from a prior session" do
    saved = SavedArticles.new(articles: @articles, ids: ["unknown"])

    assert_empty saved.ids
    assert_empty saved.articles
  end

  test "removes an article idempotently" do
    id = @articles.first.fetch("id")
    @saved.add(id)

    assert_equal :removed, @saved.remove(id)
    assert_equal :not_saved, @saved.remove(id)
    assert_empty @saved.ids
  end

  test "caps the list at twenty articles" do
    saved = SavedArticles.new(articles: @articles, ids: @articles.first(20).map { |article| article.fetch("id") })

    assert_equal :limit_reached, saved.add(@articles.fetch(20).fetch("id"))
    assert_equal 20, saved.ids.length
  end
end
