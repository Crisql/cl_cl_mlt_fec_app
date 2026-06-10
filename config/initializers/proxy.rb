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

# API publica de Hacienda para busqueda de codigos CABYS.
# El proxy enruta aqui las llamadas con header API: ApiCabysURL (ver proxy_controller.rb).
# El frontend llama /api/Cabys?codigo=... o /api/Cabys?q=...
Rails.application.config.api_cabys_url = ENV.fetch('API_CABYS_URL', 'https://api.hacienda.go.cr/fe/cabys/')
