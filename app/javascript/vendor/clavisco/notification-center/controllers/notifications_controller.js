import { Controller } from "@hotwired/stimulus"

// Replicates @clavisco/notification-center
export default class extends Controller {
  static targets = ["badge", "panel"]

  connect() {
    this.notifications = []
    this.isOpen = false
  }

  toggle() {
    this.isOpen = !this.isOpen
    // TODO: Implement notification panel
    console.log("Toggle notifications panel")
  }

  addNotification(notification) {
    this.notifications.push(notification)
    this.updateBadge()
  }

  updateBadge() {
    if (this.hasBadgeTarget) {
      if (this.notifications.length > 0) {
        this.badgeTarget.classList.remove("hidden")
      } else {
        this.badgeTarget.classList.add("hidden")
      }
    }
  }
}
