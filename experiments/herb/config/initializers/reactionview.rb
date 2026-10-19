ReActionView.configure do |config|
  config.intercept_erb = true
  config.slots = true
  config.debug_mode = false
  config.dev_server = false
  config.validation_mode = :raise
end
