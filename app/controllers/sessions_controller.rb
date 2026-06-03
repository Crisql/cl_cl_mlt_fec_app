# frozen_string_literal: true

class SessionsController < ApplicationController
  # GET /login
  def new
    # Renderiza la vista de login.
    # La lógica de autenticación es 100% client-side (Stimulus + localStorage).
    # Si ya hay sesión válida, el Stimulus controller redirige a /home.
  end
end
