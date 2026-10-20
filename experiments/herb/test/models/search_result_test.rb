require "test_helper"

class SearchResultTest < ActiveSupport::TestCase
  test "keeps Pagefind order, rejects unknown IDs, and escapes untrusted excerpts" do
    content = PublishedContent.new
    ids = [content.articles.last.id, "unknown", content.articles.first.id]

    result = SearchResult.from_pagefind(content: content, ids: ids,
      excerpts: { ids.last => '<img src=x onerror=alert(1)>before <mark>match</mark>' }, tag: "")

    assert_equal ids.values_at(0, 2), result.articles.map(&:id)
    assert_equal "&lt;img src=x onerror=alert(1)&gt;before <mark>match</mark>", result.excerpts.fetch(ids.last)
  end

  test "falls back to title and tag search" do
    result = SearchResult.fallback(content: PublishedContent.new, query: "Ｅｒｒｏｒ", tag: "react")

    assert_equal ["local:func-error-boundary"], result.articles.map(&:id)
    assert_empty result.excerpts
  end
end
