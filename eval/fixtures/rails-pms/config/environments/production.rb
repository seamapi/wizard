Rails.application.configure do
  # Settings specified here take precedence over those in config/application.rb.

  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false

  # Serve static files from the /public folder.
  config.public_file_server.enabled = true

  config.log_level = :info
  config.log_tags = [:request_id]

  config.active_record.dump_schema_after_migration = false
  config.i18n.fallbacks = true
  config.active_support.report_deprecations = false
end
