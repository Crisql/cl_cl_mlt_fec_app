# frozen_string_literal: true

# HomeController — Dashboard principal de la aplicación.
#
# La autenticación es 100% client-side (token en localStorage).
# Rails solo sirve la vista; toda la lógica de sesión, banner y
# charts se maneja en el Stimulus controller (home_controller.js).
class HomeController < ApplicationController
  layout 'protected'

  def index
    # Banner servido vía /banner.json (public/).
    # Menú, empresa y permisos: client-side via Stimulus.
  end
end
