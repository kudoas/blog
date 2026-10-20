require "test_helper"

class ReadingListTest < ActiveSupport::TestCase
  test "only saves known articles once and discards stale session IDs" do
    content = PublishedContent.new
    list = ReadingList.new(content: content, ids: ["unknown"])
    id = content.articles.first.id

    assert_empty list.ids
    assert_equal :not_found, list.add("unknown")
    assert_equal :added, list.add(id)
    assert_equal :already_saved, list.add(id)
    assert_equal [id], list.articles.map(&:id)
  end

  test "caps saved articles at twenty" do
    content = PublishedContent.new
    list = ReadingList.new(content: content, ids: content.articles.first(20).map(&:id))

    assert_equal :limit_reached, list.add(content.articles.fetch(20).id)
  end

  test "removes a saved article idempotently" do
    content = PublishedContent.new
    list = ReadingList.new(content: content)
    id = content.articles.first.id
    list.add(id)

    assert_equal :removed, list.remove(id)
    assert_equal :not_saved, list.remove(id)
    assert_empty list.articles
  end
end
