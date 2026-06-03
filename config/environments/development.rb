# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true

  # Caché en memoria en desarrollo
  config.cache_store = :memory_store
  config.public_file_server.headers = { 'cache-control' => "public, max-age=#{2.days.to_i}" }

  # Logs detallados
  config.log_level = :debug
  config.log_tags = [:request_id]

  # Assets
  config.assets.debug = true
  config.assets.quiet = true

  # Raises en lugar de 404 para rutas faltantes
  config.action_controller.raise_on_missing_callback_actions = true
end
