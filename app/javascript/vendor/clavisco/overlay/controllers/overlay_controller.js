import { Controller } from "@hotwired/stimulus"

// Replicates @clavisco/overlay - Loading overlay
export default class extends Controller {
  static targets = ["container", "message"]

  connect() {
    // Listen for overlay events
    document.addEventListener("overlay:show", this.show.bind(this))
    document.addEventListener("overlay:hide", this.hide.bind(this))
  }

  disconnect() {
    document.removeEventListener("overlay:show", this.show.bind(this))
    document.removeEventListener("overlay:hide", this.hide.bind(this))
  }

  show(event) {
    const message = event.detail?.message || "Cargando..."
    if (this.hasMessageTarget) {
      this.messageTarget.textContent = message
    }
    if (this.hasContainerTarget) {
      this.containerTarget.classList.remove("hidden")
    } else {
      document.getElementById("overlay")?.classList.remove("hidden")
    }
  }

  hide() {
    if (this.hasContainerTarget) {
      this.containerTarget.classList.add("hidden")
    } else {
      document.getElementById("overlay")?.classList.add("hidden")
    }
  }
}
