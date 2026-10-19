require "json"

class ContentRepository
  def initialize(path: Rails.root.join("build/content.json"))
    data = JSON.parse(File.read(path))
    raise ArgumentError, "Unsupported Herb content schema" unless data.fetch("schemaVersion") == 1

    @posts = data.fetch("posts")
    @articles = data.fetch("articles")
    @taxonomies = data.fetch("taxonomies")
    @posts_by_slug = @posts.to_h { |post| [post.fetch("slug"), post] }
  end

  attr_reader :posts, :articles

  def find_post(slug)
    @posts_by_slug[slug]
  end

  def terms(field)
    @taxonomies.fetch(field.to_s)
  end

  def filter(query:, tag:)
    search = normalize(query)
    selected_tag = tag_slug(tag)
    @articles.select do |article|
      tags = article.fetch("tags")
      (search.empty? || normalize([article.fetch("title"), *tags].join(" ")).include?(search)) &&
        (selected_tag.empty? || tags.any? { |value| tag_slug(value) == selected_tag })
    end
  end

  private

  def normalize(value)
    value.to_s.unicode_normalize(:nfkc).downcase.strip
  end

  def tag_slug(value)
    normalize(value).gsub(/\s+/, "-")
  end
end
