# frozen_string_literal: true

module Configurations
  # RolesController — Vista de gestión de roles.
  #
  # Sirve la shell HTML; toda la lógica de tabla, modal y llamadas API
  # se maneja en Stimulus (roles_controller.js).
  #
  # Replica: /Rol (Angular RolComponent)
  class RolesController < ApplicationController
    layout 'protected'

    def index; end
  end
end
