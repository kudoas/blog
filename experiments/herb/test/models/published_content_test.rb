require "test_helper"

class PublishedContentTest < ActiveSupport::TestCase
  test "loads published articles as models and finds posts by slug" do
    content = PublishedContent.new

    assert_equal 22, content.articles.length
    assert_instance_of Article, content.articles.first
    assert_equal "Error BoundaryをFunction Componentで扱う", content.post("func-error-boundary").fetch("title")
    assert_nil content.post("../content/external.yaml")
    assert content.articles.any? { |article| article.fetch("kind") == "external" }
  end

  test "article matching normalizes titles and tags" do
    content = PublishedContent.new

    assert_equal ["local:func-error-boundary"], content.search(query: "Ｅｒｒｏｒ", tag: "react").map(&:id)
  end

  test "taxonomy selection uses the article's normalized tags" do
    content = PublishedContent.new

    assert_includes content.tagged(field: :tags, slug: "react").map(&:id), "local:func-error-boundary"
  end
end
