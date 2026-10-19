require "herb/engine/scoped_style/visitor"

ReActionView.configure do |config|
  config.intercept_erb = true
  config.slots = true
  config.debug_mode = false
  config.dev_server = false
  config.validation_mode = :raise
  config.engine.visitors.use(Herb::Engine::ScopedStyle::Visitor.new)
end
