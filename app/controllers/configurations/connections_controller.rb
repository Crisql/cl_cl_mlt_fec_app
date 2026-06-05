# frozen_string_literal: true

module Configurations
  # ConnectionsController — Lista y formulario de conexiones SAP.
  #
  # Sirve la shell HTML; toda la lógica de tabla, búsqueda y
  # llamadas API se maneja en Stimulus (connections_controller.js,
  # connection_form_controller.js).
  #
  # Replica: /configuration/connections (Angular ConnectionsComponent +
  #          CreateOrUpdateConnectionComponent)
  class ConnectionsController < ApplicationController
    layout 'protected'

    def index; end

    def new; end

    def edit; end
  end
end
