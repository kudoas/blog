require "time"

module BlogHelper
  def canonical_url
    path = request.path == "/" ? "/" : "#{request.path.chomp('/')}/"
    "https://blog.da1chi.net#{path}"
  end

  def tag_slug(value)
    value.unicode_normalize(:nfkc).downcase.strip.gsub(/\s+/, "-")
  end

  def tag_url(value)
    "/tags/#{ERB::Util.url_encode(tag_slug(value))}/"
  end

  def format_date(value)
    Time.iso8601(value).getlocal("+09:00").strftime("%Y.%m.%d")
  end
end
