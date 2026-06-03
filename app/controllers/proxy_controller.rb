# frozen_string_literal: true

# ProxyController — reenvía todas las llamadas /api/* al backend externo.
#
# Arquitectura:
#   Browser → Rails /api/* → ProxyController → API externo (FEC App o FEC Sync)
#
# Enrutamiento por path:
#   - /api/token, /api/Users/*, /api/Companies/*, /api/Passwords/* → API_FE_APP_URL
#   - Todo lo demás bajo /api/*                                    → API_FE_APP_URL (default)
#
# El token de autorización viaja en el header Authorization del request original
# y se reenvía sin modificación.
class ProxyController < ApplicationController
  protect_from_forgery with: :null_session

  # Rutas que van al API de la aplicación (auth, usuarios, empresas, etc.)
  APP_API_PATHS = %w[
    token
    Users
    Companies
    Passwords
    Permissions
    Menu
  ].freeze

  def forward
    target_url = build_target_url
    response   = forward_request(target_url)

    # Reenviar status, content-type y body al cliente
    self.response.status = response.status
    self.response.headers['Content-Type'] = response.headers['Content-Type'] || 'application/json'
    render plain: response.body, status: response.status
  rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
    render json: { error: 'Error de conexión con el servidor', detail: e.message },
           status: :bad_gateway
  rescue StandardError => e
    Rails.logger.error "[ProxyController] #{e.class}: #{e.message}"
    render json: { error: 'Error interno del proxy' }, status: :internal_server_error
  end

  private

  def api_path
    # Extrae el path después de /api/  → "token", "Users/GetUserInfo", etc.
    params[:path].to_s
  end

  def build_target_url
    base = resolve_base_url
    path = api_path
    url  = "#{base}/api/#{path}"
    url += "?#{request.query_string}" if request.query_string.present?
    url
  end

  def resolve_base_url
    first_segment = api_path.split('/').first.to_s

    if APP_API_PATHS.any? { |p| first_segment.casecmp?(p) }
      Rails.application.config.api_fe_app_url
    else
      Rails.application.config.api_fe_sync_url
    end
  end

  def forward_request(url)
    conn = Faraday.new(url: url) do |f|
      f.options.timeout      = 30
      f.options.open_timeout = 10
    end

    headers = forward_headers

    case request.method.upcase
    when 'GET'    then conn.get('',    nil,          headers)
    when 'POST'   then conn.post('',   request.raw_post, headers)
    when 'PUT'    then conn.put('',    request.raw_post, headers)
    when 'PATCH'  then conn.patch('',  request.raw_post, headers)
    when 'DELETE' then conn.delete('', nil,          headers)
    else
      raise "HTTP method no soportado: #{request.method}"
    end
  end

  def forward_headers
    headers = { 'Content-Type' => request.content_type.presence || 'application/json' }

    # Reenviar Authorization si existe (token Bearer)
    headers['Authorization'] = request.headers['Authorization'] if request.headers['Authorization'].present?

    # Reenviar company header si existe
    headers['cl-company-id'] = request.headers['cl-company-id'] if request.headers['cl-company-id'].present?

    headers
  end
end
