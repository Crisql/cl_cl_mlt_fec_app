# frozen_string_literal: true

module Documents
  # Creación de documentos electrónicos de Hacienda Costa Rica.
  # Pantalla única parametrizada por tipo de documento (docType) recibido por ruta:
  #   01 = FE  (Factura Electrónica)
  #   02 = ND  (Nota de Débito)
  #   03 = NC  (Nota de Crédito)
  #   08 = FEC (Factura Electrónica de Compra)
  #   10 = REP (Recibo Electrónico de Pago)
  #
  # Migrado desde Angular legacy /createDocument/:docType → /documents/:type/create.
  class CreateController < ApplicationController
    layout 'protected'

    VALID_TYPES = %w[01 02 03 08 10].freeze

    def index
      @doc_type = params[:type]
      redirect_to home_path unless VALID_TYPES.include?(@doc_type)
    end
  end
end
