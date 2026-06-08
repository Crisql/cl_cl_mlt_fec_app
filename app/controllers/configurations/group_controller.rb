# frozen_string_literal: true

module Configurations
  # GroupController — Vista de gestión de grupos (cuentas).
  #
  # Sirve la shell HTML; toda la lógica (carga del grupo, tablas de compañías
  # y usuarios, actualización, restablecer formato, crear grupo) se maneja
  # en Stimulus (group_controller.js).
  class GroupController < ApplicationController
    layout 'protected'

    def index; end
  end
end
