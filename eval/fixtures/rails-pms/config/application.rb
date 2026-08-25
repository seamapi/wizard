require_relative "boot"

require "rails"
# Pick only the frameworks this PMS actually needs (no Action Mailer, Active
# Job, Action Cable, or the asset pipeline — the views inline their own CSS).
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"

# Require the gems listed in Gemfile, including any gems limited to the current
# Rails environment.
Bundler.require(*Rails.groups)

module RailsPms
  class Application < Rails::Application
    config.load_defaults 7.1

    # Server-rendered ERB views, not an API-only app.
    config.api_only = false
  end
end
