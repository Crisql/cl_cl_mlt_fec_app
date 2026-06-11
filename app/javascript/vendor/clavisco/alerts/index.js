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
      'text-sm text-white max-w-lg transition-all duration-300',
      config.bg,
    ].join(' ');
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="material-icons text-base mt-0.5 flex-shrink-0">${config.icon}</span>
      <span class="flex-1 break-words min-w-0">${escapedMsg}</span>
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

      const config = {
        [ALERT_TYPES.SUCCESS]: { iconColor: '#16a34a', iconBg: '#f0fdf4', icon: 'check_circle', confirmBg: '#16a34a', confirmHover: '#15803d' },
        [ALERT_TYPES.ERROR]:   { iconColor: '#dc2626', iconBg: '#fef2f2', icon: 'error',       confirmBg: '#dc2626', confirmHover: '#b91c1c' },
        [ALERT_TYPES.WARNING]: { iconColor: '#d97706', iconBg: '#fffbeb', icon: 'warning',     confirmBg: '#d97706', confirmHover: '#b45309' },
        [ALERT_TYPES.INFO]:    { iconColor: '#2563eb', iconBg: '#eff6ff', icon: 'info',        confirmBg: '#2563eb', confirmHover: '#1d4ed8' },
      }[type] ?? { iconColor: '#6b7280', iconBg: '#f9fafb', icon: 'info', confirmBg: '#2563eb', confirmHover: '#1d4ed8' }

      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center'
      modal.style.backgroundColor = 'rgba(0,0,0,0.4)'
      modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
          <div class="px-6 pt-6 pb-5 text-center">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style="background-color:${config.iconBg}">
              <span class="material-icons text-3xl" style="color:${config.iconColor}">${config.icon}</span>
            </div>
            ${title ? `<h3 class="text-base font-semibold text-gray-900 mb-1">${title}</h3>` : ''}
            <p class="text-sm text-gray-500">${message}</p>
          </div>
          <div class="flex justify-around gap-2 px-6 pb-5">
            ${showCancel ? `
              <button type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      data-action="cancel">
                ${cancelText}
              </button>
            ` : ''}
            <button type="button"
                    class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style="background-color:${config.confirmBg}"
                    onmouseover="this.style.backgroundColor='${config.confirmHover}'"
                    onmouseout="this.style.backgroundColor='${config.confirmBg}'"
                    data-action="confirm">
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

  confirm(message, title = 'Confirmar', type = ALERT_TYPES.WARNING) {
    return this.showAlert({
      type,
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

export function confirm(message, title, type) {
  return alerts.confirm(message, title, type)
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
