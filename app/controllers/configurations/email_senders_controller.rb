# frozen_string_literal: true

module Configurations
  # EmailSendersController — Gestión de bandejas de envío de correo y asignación a compañías.
  #
  # Replica: /emailInbox (Angular EmailInboxComponent con tabs:
  #   - EmailInboxConfigComponent  → tab "Bandeja de Correos"
  #   - EmailInboxAssigmentComponent → tab "Asignación de Bandejas a Compañías")
  # La lógica de tabla, paneles y asignación se maneja en Stimulus (email_senders_controller.js).
  class EmailSendersController < ApplicationController
    layout 'protected'

    def index; end
  end
end
