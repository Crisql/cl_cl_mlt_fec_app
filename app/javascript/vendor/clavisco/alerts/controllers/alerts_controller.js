import { Controller } from "@hotwired/stimulus"
import { showToast, showAlert } from 'vendor/clavisco/alerts'

/**
 * AlertsController — Stimulus wrapper para el sistema de notificaciones.
 * Delega toda la lógica al singleton de AlertsService (vendor/clavisco/alerts/index.js)
 * para garantizar estilos y comportamiento consistentes en toda la app.
 */
export default class extends Controller {
  static targets = ["container"]

  connect() {
    document.addEventListener("toast", this.#handleToast)
  }

  disconnect() {
    document.removeEventListener("toast", this.#handleToast)
  }

  #handleToast = (event) => {
    const { message, type, duration } = event.detail
    showToast(message, type, duration)
  }

  // Proxy público — permite llamar desde otros controllers si tienen ref al controller
  showToast(message, type = 'info', duration) {
    showToast(message, type, duration)
  }

  showAlert(options) {
    return showAlert(options)
  }
}
