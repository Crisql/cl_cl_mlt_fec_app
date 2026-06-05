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
   * Show toast notification.
   * Appends a new toast element to #toast-container (present in both layouts).
   * Supports multiple simultaneous toasts; each auto-dismisses independently.
   *
   * @param {string} message  - Message to display (plain text, escaped internally)
   * @param {string} type     - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - Auto-dismiss delay in ms (default 4000)
   */
  showToast(message, type = 'success', duration = 4000) {
    const config = {
      success: { bg: 'bg-green-600', icon: 'check_circle' },
      error:   { bg: 'bg-red-600',   icon: 'error'         },
      warning: { bg: 'bg-yellow-500', icon: 'warning'      },
      info:    { bg: 'bg-blue-600',  icon: 'info'          },
    }[type] ?? { bg: 'bg-gray-700', icon: 'notifications' };

    const container = document.getElementById('toast-container');
    if (!container) return;

    // Escape plain text to prevent XSS
    const safe = document.createElement('div');
    safe.appendChild(document.createTextNode(message || ''));
    const escapedMsg = safe.innerHTML;

    const toast = document.createElement('div');
    toast.className = [
      'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg',
      'text-sm text-white max-w-sm transition-all duration-300',
      config.bg,
    ].join(' ');
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="material-icons text-base mt-0.5 flex-shrink-0">${config.icon}</span>
      <span class="flex-1">${escapedMsg}</span>
      <button type="button" class="flex-shrink-0 hover:opacity-75 ml-1" onclick="this.closest('[role=alert]').remove()">
        <span class="material-icons text-sm">close</span>
      </button>
    `;

    container.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => toast.remove(), 300);
    };
    setTimeout(dismiss, duration);
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
