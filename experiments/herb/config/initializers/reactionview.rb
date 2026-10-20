require "herb/engine/scoped_style/visitor"

ReActionView.configure do |config|
  config.intercept_erb = true
  config.slots = true
  config.debug_mode = Rails.env.development?
  config.dev_server = Rails.env.development?
  config.validation_mode = :raise
  config.engine.visitors.use(Herb::Engine::ScopedStyle::Visitor.new)
end
