import { Controller } from "@hotwired/stimulus"

// Replicates @clavisco/alerts - Toast notifications
export default class extends Controller {
  static targets = ["container"]

  connect() {
    // Listen for toast events
    document.addEventListener("toast", this.handleToast.bind(this))
  }

  disconnect() {
    document.removeEventListener("toast", this.handleToast.bind(this))
  }

  handleToast(event) {
    const { message, type } = event.detail
    this.showToast(message, type)
  }

  showToast(message, type = "info") {
    const colors = {
      success: "bg-green-500",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      info: "bg-blue-500"
    }

    const icons = {
      success: "check_circle",
      error: "error",
      warning: "warning",
      info: "info"
    }

    const toast = document.createElement("div")
    toast.className = `toast ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg mb-2 flex items-center space-x-3 transform transition-all duration-300`
    toast.setAttribute("role", "alert")
    toast.innerHTML = `
      <span class="material-icons">${icons[type]}</span>
      <span class="flex-1">${message}</span>
      <button type="button" class="hover:opacity-75" onclick="this.parentElement.remove()">
        <span class="material-icons text-sm">close</span>
      </button>
    `

    if (this.hasContainerTarget) {
      this.containerTarget.appendChild(toast)
    } else {
      document.getElementById("toast-container")?.appendChild(toast)
    }

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-full")
      setTimeout(() => toast.remove(), 300)
    }, 5000)
  }

  // Show modal alert (replicates AlertsService.ShowAlert)
  showAlert(options) {
    // TODO: Implement modal alert
    console.log("Show alert:", options)
  }
}
