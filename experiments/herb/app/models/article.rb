class Article
  def initialize(attributes)
    @attributes = attributes
  end

  def id
    @attributes.fetch("id")
  end

  def tagged?(slug)
    normalized = self.class.normalize(slug).gsub(/\s+/, "-")
    normalized.empty? || fetch("tags").any? { |tag| self.class.normalize(tag).gsub(/\s+/, "-") == normalized }
  end

  def fetch(key)
    @attributes.fetch(key)
  end

  def as_json(*)
    @attributes
  end

  def self.normalize(value)
    value.to_s.unicode_normalize(:nfkc).downcase.strip
  end
end
