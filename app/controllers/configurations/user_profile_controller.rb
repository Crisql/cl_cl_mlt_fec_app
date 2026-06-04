# frozen_string_literal: true

module Configurations
  # UserProfileController — Vista de actualización de información del usuario.
  #
  # Sirve la shell HTML; toda la lógica de formulario, validación de credenciales
  # SAP y actualización de datos se maneja en Stimulus (user_profile_controller.js).
  class UserProfileController < ApplicationController
    layout 'protected'

    def index; end
  end
end
