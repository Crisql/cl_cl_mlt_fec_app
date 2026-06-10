# frozen_string_literal: true

module Configurations
  # MailParserController — Gestión de procesadores de correo.
  #
  # Replica: /configurations/mail-parser-config (Angular MailParserConfigComponent)
  # La lógica de tabla, panel lateral y panel de compañías emisoras se maneja
  # en Stimulus (mail_parser_controller.js).
  class MailParserController < ApplicationController
    layout 'protected'

    def index; end
  end
end
