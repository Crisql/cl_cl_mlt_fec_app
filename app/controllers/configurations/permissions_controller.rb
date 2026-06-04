# frozen_string_literal: true

module Configurations
  # PermissionsController — Vista de gestión de permisos.
  #
  # Sirve la shell HTML; toda la lógica de tabs, drag&drop y llamadas API
  # se maneja en Stimulus (permissions_controller.js).
  #
  # Dos sub-vistas:
  #   /configurations/permissions/by-role  → PermsByRolComponent
  #   /configurations/permissions/global   → GlobalPermsComponent
  class PermissionsController < ApplicationController
    layout 'protected'

    def index; end
  end
end
