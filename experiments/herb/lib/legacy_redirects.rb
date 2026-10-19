require "uri"

class LegacyRedirects
  def initialize(app, redirects_path: Rails.root.parent.parent.join("static/_redirects"))
    @app = app
    @rules = File.readlines(redirects_path, chomp: true).filter_map do |line|
      source, target, status, = line.split(/\s+/)
      next unless source&.start_with?("/") && target && status&.match?(/\A30[1278]\z/)

      names = []
      pattern = Regexp.new("\\A" + source.split(/(:[a-zA-Z_][a-zA-Z_0-9]*)/).map do |part|
        if part.start_with?(":")
          names << part.delete_prefix(":")
          "([^/]+)"
        else
          Regexp.escape(part)
        end
      end.join + "\\z")
      [pattern, names, target, status.to_i]
    end
  end

  def call(env)
    path = env.fetch("PATH_INFO", "/")
    if (matched = @rules.lazy.map { |pattern, names, target, status| [pattern.match(path), names, target, status] }.find { |match, _names, _target, _status| match })
      match, names, target, status = matched
      location = target.dup
      names.each_with_index { |name, index| location.gsub!(":#{name}", URI::DEFAULT_PARSER.escape(match[index + 1])) }
      location += "?#{env['QUERY_STRING']}" unless env["QUERY_STRING"].to_s.empty?
      return [status, { "location" => location, "content-type" => "text/html; charset=utf-8", "content-length" => "0" }, []]
    end

    @app.call(env)
  end
end
