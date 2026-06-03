# frozen_string_literal: true

Rails.application.routes.draw do
  # ----------------------------------------------------------------
  # Proxy — reenvía todo /api/* al backend externo
  # DEBE ir primero para que no colisione con rutas Rails
  # ----------------------------------------------------------------
  match '/api/*path', to: 'proxy#forward', via: :all

  # ----------------------------------------------------------------
  # Vistas Rails
  # ----------------------------------------------------------------
  get  '/login',   to: 'sessions#new', as: :login
  get  '/sign-in', to: redirect('/login')

  # Ruta raíz — el auth-guard client-side redirige a /home si hay sesión
  root to: 'sessions#new'
end
