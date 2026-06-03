# frozen_string_literal: true

# ProxyController — reenvía todas las llamadas /api/* al backend externo.
#
# IMPORTANTE: Este proxy es 100% TRANSPARENTE.
# - Solo cambia la base URL
# - Reenvía TODOS los headers del browser tal como llegan
# - La UI maneja autenticación (OAuth2 token)
# - La UI incluye cl-company-id header
#
# Nota de path para /api/token:
#   UI llama: /api/token → API espera: /token  (nivel raíz, sin /api)
#   UI llama: /api/Menu  → API espera: /api/Menu (mantiene prefijo /api)
class ProxyController < ApplicationController
  skip_before_action :verify_authenticity_token
  skip_before_action :allow_browser, raise: false

  def forward
    target_url = "#{api_base_url}#{request.fullpath}"

    Rails.logger.info  "[Proxy] #{request.method} #{target_url}"
    Rails.logger.info  "[Proxy] Content-Type: #{request.content_type}"

    uri        = URI.parse(target_url)
    http       = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl      = (uri.scheme == 'https')
    http.read_timeout = 30
    http.open_timeout = 10

    # En desarrollo se deshabilita verificación SSL (issues de CRL / certificados locales)
    http.verify_mode = if Rails.env.development? || ENV['SKIP_SSL_VERIFICATION'] == 'true'
      OpenSSL::SSL::VERIFY_NONE
    else
      OpenSSL::SSL::VERIFY_PEER
    end

    body = request.raw_post.presence
    Rails.logger.info "[Proxy] Body (#{body&.bytesize || 0} bytes): #{body.inspect}"

    http_request      = build_http_request(request.method, uri, forwarded_headers)
    http_request.body = body
    response          = http.request(http_request)

    Rails.logger.info "[Proxy] Response: #{response.code}"
    Rails.logger.error "[Proxy] Error body: #{response.body.to_s[0..500]}" if response.code.to_i >= 400

    # Reenviar headers de paginación al cliente
    response.each_header do |key, value|
      if key.downcase.start_with?('cl-sl-pagination', 'cl-dba-pagination') || key.downcase == 'cl-message'
        self.response.headers[key] = value
      end
    end

    render body: response.body,
           status: response.code.to_i,
           content_type: response['Content-Type'] || 'application/json'

  rescue Net::ReadTimeout, Net::OpenTimeout => e
    Rails.logger.error "[Proxy] Timeout: #{e.message}"
    render json: { error: 'API request timed out' }, status: :gateway_timeout
  rescue StandardError => e
    Rails.logger.error "[Proxy] #{e.class}: #{e.message}"
    render json: { error: "API request failed: #{e.message}" }, status: :bad_gateway
  end

  private

  def api_base_url
    Rails.application.config.api_fe_app_url
  end

  def build_http_request(method, uri, headers)
    klass = case method.upcase
            when 'GET'     then Net::HTTP::Get
            when 'POST'    then Net::HTTP::Post
            when 'PUT'     then Net::HTTP::Put
            when 'PATCH'   then Net::HTTP::Patch
            when 'DELETE'  then Net::HTTP::Delete
            when 'OPTIONS' then Net::HTTP::Options
            when 'HEAD'    then Net::HTTP::Head
            else Net::HTTP::Get
            end

    req = klass.new(uri.request_uri)
    headers.each { |key, value| req[key] = value }
    req['Host'] = uri.host  # Host correcto del API destino, no localhost:3000
    req
  end

  def forwarded_headers
    headers = {}

    request.headers.each do |key, value|
      if key.start_with?('HTTP_')
        header_name = key.sub(/^HTTP_/, '').split('_').map(&:capitalize).join('-')
        # Mantener headers cl-* en minúsculas (el backend .NET puede ser case-sensitive)
        header_name = header_name.downcase if header_name.start_with?('Cl-')
        headers[header_name] = value
      elsif %w[CONTENT_TYPE CONTENT_LENGTH].include?(key)
        headers[key.split('_').map(&:capitalize).join('-')] = value
      end
    end

    # Sin Accept-Encoding → respuestas sin comprimir (evita problemas con gzip/brotli)
    headers.delete('Accept-Encoding')

    # Headers que no deben llegar al backend (igual que Angular legacy: withCredentials: false)
    %w[Cookie Referer Origin Sec-Fetch-Site Sec-Fetch-Mode Sec-Fetch-Dest
       Sec-Ch-Ua Sec-Ch-Ua-Mobile Sec-Ch-Ua-Platform Connection Pragma Cache-Control Host].each do |h|
      headers.delete(h)
    end

    Rails.logger.info "[Proxy] Headers: #{headers.except('Authorization').inspect}"
    headers
  end
end
