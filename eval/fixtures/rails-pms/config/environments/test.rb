Rails.application.configure do
  # Settings specified here take precedence over those in config/application.rb.

  config.enable_reloading = false
  config.eager_load = false

  config.consider_all_requests_local = true
  config.action_controller.perform_caching = false

  config.action_dispatch.show_exceptions = :rescuable
  config.action_controller.allow_forgery_protection = false

  config.active_support.deprecation = :stderr
end
