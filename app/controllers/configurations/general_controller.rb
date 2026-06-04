# frozen_string_literal: true

module Configurations
  # GeneralController — Vista de configuraciones generales.
  #
  # Sirve la shell HTML; toda la lógica (carga de configuraciones, upload de
  # formato .rpt, actualización de cédula proveedor sistemas, download) se
  # maneja en Stimulus (general_configs_controller.js).
  class GeneralController < ApplicationController
    layout 'protected'

    def index; end
  end
end
