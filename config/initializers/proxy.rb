# frozen_string_literal: true

# ---------------------------------------------------------------
# URLs de los APIs externos FEC
# Configurar en .env (ver .env.example)
# ---------------------------------------------------------------

# API de sincronización FE — emisión, consulta Hacienda, documentos
# Dev: https://clfecrbyapidev.clavisco.com
Rails.application.config.api_fe_sync_url = ENV.fetch('API_FE_SYNC_URL', 'https://clfecrbyapidev.clavisco.com')

# API de la aplicación FEC — usuarios, empresas, permisos, catálogos
# Dev: https://clfecrbyappapidev.clavisco.com
Rails.application.config.api_fe_app_url = ENV.fetch('API_FE_APP_URL', 'https://clfecrbyappapidev.clavisco.com')
