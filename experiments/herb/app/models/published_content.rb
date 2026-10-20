require "json"

class PublishedContent
  attr_reader :articles, :posts

  def initialize(path: Rails.root.join("build/content.json"))
    data = JSON.parse(File.read(path))
    raise ArgumentError, "Unsupported Herb content schema" unless data.fetch("schemaVersion") == 1

    @posts = data.fetch("posts")
    @articles = data.fetch("articles").map { |attributes| Article.new(attributes) }
    @articles_by_id = @articles.index_by(&:id)
    @posts_by_slug = @posts.index_by { |post| post.fetch("slug") }
    @taxonomies = data.fetch("taxonomies")
  end

  def post(slug)
    @posts_by_slug[slug]
  end

  def article(id)
    @articles_by_id[id]
  end

  def terms(field)
    @taxonomies.fetch(field.to_s)
  end

  def search(query:, tag:)
    @articles.select { |article| article.matches?(query) && article.tagged?(tag) }
  end

  def tagged(field:, slug:)
    @articles.select do |article|
      article.fetch(field.to_s).any? { |value| Article.normalize(value).gsub(/\s+/, "-") == slug }
    end
  end
end
