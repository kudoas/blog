require "test_helper"

class ContentRepositoryTest < ActiveSupport::TestCase
  test "loads the same published posts and external articles as the Astro build" do
    repository = ContentRepository.new(path: Rails.root.join("build/content.json"))

    assert_equal 9, repository.posts.length
    assert_equal 22, repository.articles.length
    assert_equal "Error BoundaryをFunction Componentで扱う", repository.find_post("func-error-boundary")["title"]
    assert_includes repository.find_post("func-error-boundary")["bodyHtml"], "astro-code"
    assert_nil repository.find_post("../content/external.yaml")
    assert_nil repository.find_post("missing")
    assert repository.articles.any? { |article| article["kind"] == "external" }
  end
end
