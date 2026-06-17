# frozen_string_literal: true

module Configurations
  # UdfsController — Campos definidos por usuario (UDFs).
  #
  # Sirve la shell HTML; toda la lógica de tabla, checkboxes y guardado
  # se maneja en Stimulus (udfs_controller.js).
  #
  # Replica: /udfs (Angular UdfsComponent — configuration/udfs)
  class UdfsController < ApplicationController
    layout 'protected'

    def index; end
  end
end
