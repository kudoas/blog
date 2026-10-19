require "test_helper"

class SearchSelectionTest < ActiveSupport::TestCase
  setup do
    @repository = ContentRepository.new
  end

  test "keeps Pagefind relevance order and ignores unknown IDs" do
    ids = [@repository.articles.last.fetch("id"), "unknown", @repository.articles.first.fetch("id")]
    selection = SearchSelection.new(@repository).resolve(ids: ids, excerpts: {}, query: "test", tag: "", fallback: false)

    assert_equal ids.values_at(0, 2), selection.fetch(:articles).map { |article| article.fetch("id") }
  end

  test "allows only mark tags in excerpts" do
    id = @repository.articles.first.fetch("id")
    selection = SearchSelection.new(@repository).resolve(
      ids: [id], excerpts: { id => '<img src=x onerror=alert(1)>before <mark>match</mark>' },
      query: "match", tag: "", fallback: false
    )

    assert_equal "&lt;img src=x onerror=alert(1)&gt;before <mark>match</mark>", selection.fetch(:excerpts).fetch(id)
  end

  test "fallback matches titles and tags with NFKC normalization" do
    selection = SearchSelection.new(@repository).resolve(ids: [], excerpts: {}, query: "Ｅｒｒｏｒ", tag: "react", fallback: true)

    assert_equal ["local:func-error-boundary"], selection.fetch(:articles).map { |article| article.fetch("id") }
  end
end
