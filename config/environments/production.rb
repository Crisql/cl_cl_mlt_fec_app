# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false

  config.log_level = :info
  config.log_tags = [:request_id]

  config.cache_store = :solid_cache_store
  config.active_job.queue_adapter = :solid_queue

  config.force_ssl = true
end
