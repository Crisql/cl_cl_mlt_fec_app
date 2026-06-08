# frozen_string_literal: true

module Configurations
  # NumberingController — Vista de configuración de numeración.
  #
  # Sirve la shell HTML; toda la lógica (tablas, paneles, llamadas API)
  # se maneja en Stimulus (numbering_controller.js).
  #
  # Replica: /numbering (Angular NumberingConfigComponent)
  # Renombrado a: /configurations/numbering
  class NumberingController < ApplicationController
    layout 'protected'

    def index; end
  end
end
