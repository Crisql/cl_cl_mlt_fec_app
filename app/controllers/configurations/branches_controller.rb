# frozen_string_literal: true

module Configurations
  # BranchesController — Vista de gestión de sucursales.
  #
  # Sirve la shell HTML; toda la lógica de tabla, panel y llamadas API
  # se maneja en Stimulus (branches_controller.js).
  #
  # Replica: /sucursal (Angular SucursalComponent)
  class BranchesController < ApplicationController
    layout 'protected'

    def index; end
  end
end
