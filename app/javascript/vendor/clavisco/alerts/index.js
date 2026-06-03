/**
 * @clavisco/alerts - Alert and toast notification system
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

// Re-export the Stimulus controller (use importmap pin, not relative path)
export { default as AlertsController } from 'vendor/clavisco/alerts/controllers/alerts_controller'

// ============================================================
// ALERT TYPES
// ============================================================

export const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

// ============================================================
// ALERTS SERVICE
// ============================================================

class AlertsService {
  constructor() {
    this.containerSelector = '#toast-container'
  }

  /**
   * Get or create toast container
   * @returns {HTMLElement} Container element
   */
  getContainer() {
    let container = document.querySelector(this.containerSelector)

    if (!container) {
      container = document.createElement('div')
      container.id = 'toast-container'
      container.className = 'fixed top-4 right-4 z-[9999] flex flex-col space-y-2'
      document.body.appendChild(container)
    }

    return container
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Alert type
   * @param {number} duration - Duration in ms
   */
  showToast(message, type = ALERT_TYPES.INFO, duration = 5000) {
    const container = this.getContainer()

    const colors = {
      [ALERT_TYPES.SUCCESS]: 'bg-green-500',
      [ALERT_TYPES.ERROR]: 'bg-red-500',
      [ALERT_TYPES.WARNING]: 'bg-yellow-500',
      [ALERT_TYPES.INFO]: 'bg-blue-500'
    }

    const icons = {
      [ALERT_TYPES.SUCCESS]: 'check_circle',
      [ALERT_TYPES.ERROR]: 'error',
      [ALERT_TYPES.WARNING]: 'warning',
      [ALERT_TYPES.INFO]: 'info'
    }

    const toast = document.createElement('div')
    toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 transform transition-all duration-300 translate-x-0`
    toast.innerHTML = `
      <span class="material-icons">${icons[type]}</span>
      <span class="flex-1">${message}</span>
      <button type="button" class="hover:opacity-75 ml-2" onclick="this.parentElement.remove()">
        <span class="material-icons text-sm">close</span>
      </button>
    `

    container.appendChild(toast)

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full')
        setTimeout(() => toast.remove(), 300)
      }, duration)
    }

    return toast
  }

  /**
   * Show modal alert/confirmation
   * @param {Object} options - Alert options
   * @returns {Promise<boolean|any>} User response
   */
  showAlert(options) {
    return new Promise((resolve) => {
      const {
        type = ALERT_TYPES.INFO,
        title = '',
        message,
        confirmText = 'Aceptar',
        cancelText = 'Cancelar',
        showCancel = false
      } = options

      const colors = {
        [ALERT_TYPES.SUCCESS]: 'text-green-600',
        [ALERT_TYPES.ERROR]: 'text-red-600',
        [ALERT_TYPES.WARNING]: 'text-yellow-600',
        [ALERT_TYPES.INFO]: 'text-blue-600'
      }

      const icons = {
        [ALERT_TYPES.SUCCESS]: 'check_circle',
        [ALERT_TYPES.ERROR]: 'error',
        [ALERT_TYPES.WARNING]: 'warning',
        [ALERT_TYPES.INFO]: 'info'
      }

      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50'
      modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="p-6 text-center">
            <span class="material-icons text-5xl ${colors[type]} mb-4">${icons[type]}</span>
            ${title ? `<h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>` : ''}
            <p class="text-gray-600">${message}</p>
          </div>
          <div class="flex ${showCancel ? 'justify-between' : 'justify-center'} gap-3 p-4 border-t">
            ${showCancel ? `
              <button type="button" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50" data-action="cancel">
                ${cancelText}
              </button>
            ` : ''}
            <button type="button" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" data-action="confirm">
              ${confirmText}
            </button>
          </div>
        </div>
      `

      const handleClick = (e) => {
        const action = e.target.dataset.action
        if (action === 'confirm') {
          resolve(true)
        } else if (action === 'cancel') {
          resolve(false)
        }
        modal.remove()
      }

      modal.addEventListener('click', handleClick)
      document.body.appendChild(modal)
    })
  }

  // Convenience methods
  success(message, duration) {
    return this.showToast(message, ALERT_TYPES.SUCCESS, duration)
  }

  error(message, duration) {
    return this.showToast(message, ALERT_TYPES.ERROR, duration)
  }

  warning(message, duration) {
    return this.showToast(message, ALERT_TYPES.WARNING, duration)
  }

  info(message, duration) {
    return this.showToast(message, ALERT_TYPES.INFO, duration)
  }

  confirm(message, title = 'Confirmar') {
    return this.showAlert({
      type: ALERT_TYPES.WARNING,
      title,
      message,
      showCancel: true
    })
  }
}

// Singleton instance
const alerts = new AlertsService()

// ============================================================
// EXPORTS
// ============================================================

export const Alerts = alerts

export function showToast(message, type, duration) {
  return alerts.showToast(message, type, duration)
}

export function showAlert(options) {
  return alerts.showAlert(options)
}

export function success(message, duration) {
  return alerts.success(message, duration)
}

export function error(message, duration) {
  return alerts.error(message, duration)
}

export function warning(message, duration) {
  return alerts.warning(message, duration)
}

export function info(message, duration) {
  return alerts.info(message, duration)
}

export function confirm(message, title) {
  return alerts.confirm(message, title)
}

export default {
  Alerts,
  ALERT_TYPES,
  showToast,
  showAlert,
  success,
  error,
  warning,
  info,
  confirm
}
