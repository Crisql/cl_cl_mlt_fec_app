# frozen_string_literal: true

class ApplicationController < ActionController::Base
  # Protección CSRF estándar
  protect_from_forgery with: :exception

  # La autenticación es 100% client-side (token en localStorage).
  # Aquí solo va lógica compartida de controllers Rails (layouts, headers, etc.)
end
