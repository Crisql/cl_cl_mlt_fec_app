# frozen_string_literal: true

module Configurations
  # CompaniesController — Búsqueda/listado y formulario de creación/edición de compañías.
  #
  # Sirve la shell HTML; toda la lógica de tabla, paginación, modales y
  # llamadas API se maneja en Stimulus (companies_controller.js).
  #
  # Replica: /configurations/company (Angular CompanyComponent +
  #          CreateOrUpdateCompanyComponent)
  class CompaniesController < ApplicationController
    layout 'protected'

    def index; end

    def new; end

    def edit; end
  end
end
