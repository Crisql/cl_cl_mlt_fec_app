Sentry.init do |config|
  config.dsn = ENV.fetch('SENTRY_DSN', 'https://86ce06abf73d75818da365755bbbb75f@o4511328163725312.ingest.us.sentry.io/4511649680457728')
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.send_default_pii = true

  config.traces_sample_rate = 1.0
end
