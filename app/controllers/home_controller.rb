# frozen_string_literal: true

# HomeController — Dashboard principal de la aplicación.
#
# La autenticación es 100% client-side (token en localStorage).
# Rails solo sirve la vista; toda la lógica de sesión, banner y
# charts se maneja en el Stimulus controller (home_controller.js).
class HomeController < ApplicationController
  def index
    # El banner se sirve vía /banner.json (asset estático en public/).
    # La vista no necesita variables de instancia adicionales.
  end
end
