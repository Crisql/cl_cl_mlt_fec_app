/**
 * @clavisco/overlay - Modal and overlay service
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

import { clPrint, CL_DISPLAY } from 'vendor/clavisco/core'

// ============================================================
// OVERLAY CONTROLLER
// ============================================================

class OverlayService {
  constructor() {
    this.openModals = new Map()
    this.zIndexBase = 1000
  }

  /**
   * Open a modal by ID
   * @param {string} modalId - Modal element ID
   * @param {Object} options - Modal options
   */
  open(modalId, options = {}) {
    const modal = document.getElementById(modalId) || document.querySelector(`[data-modal-id="${modalId}"]`)

    if (!modal) {
      clPrint(`Modal not found: ${modalId}`, CL_DISPLAY.WARNING)
      return null
    }

    // Calculate z-index
    const zIndex = this.zIndexBase + (this.openModals.size * 10)

    // Store modal state
    this.openModals.set(modalId, {
      element: modal,
      options,
      zIndex
    })

    // Apply z-index
    modal.style.zIndex = zIndex

    // Show modal
    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')

    // Prevent body scroll
    if (this.openModals.size === 1) {
      document.body.classList.add('overflow-hidden')
    }

    // Focus first focusable element
    setTimeout(() => {
      const focusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')
      focusable?.focus()
    }, 100)

    // Dispatch open event
    modal.dispatchEvent(new CustomEvent('modal:open', { detail: options }))

    return modal
  }

  /**
   * Close a modal by ID
   * @param {string} modalId - Modal element ID
   * @param {any} result - Result data to pass back
   */
  close(modalId, result = null) {
    const modalState = this.openModals.get(modalId)

    if (!modalState) {
      // Try to find by element
      const modal = document.getElementById(modalId) || document.querySelector(`[data-modal-id="${modalId}"]`)
      if (modal) {
        modal.classList.add('hidden')
        modal.setAttribute('aria-hidden', 'true')
      }
      return
    }

    const { element, options } = modalState

    // Hide modal
    element.classList.add('hidden')
    element.setAttribute('aria-hidden', 'true')

    // Remove from tracking
    this.openModals.delete(modalId)

    // Re-enable body scroll if no more modals
    if (this.openModals.size === 0) {
      document.body.classList.remove('overflow-hidden')
    }

    // Dispatch close event
    element.dispatchEvent(new CustomEvent('modal:close', { detail: result }))

    // Call callback if provided
    if (options.onClose) {
      options.onClose(result)
    }

    return result
  }

  /**
   * Close all open modals
   */
  closeAll() {
    for (const modalId of this.openModals.keys()) {
      this.close(modalId)
    }
  }

  /**
   * Check if modal is open
   * @param {string} modalId - Modal ID
   * @returns {boolean} True if open
   */
  isOpen(modalId) {
    return this.openModals.has(modalId)
  }

  /**
   * Get open modal count
   * @returns {number} Number of open modals
   */
  get openCount() {
    return this.openModals.size
  }

  /**
   * Toggle modal visibility
   * @param {string} modalId - Modal ID
   */
  toggle(modalId) {
    if (this.isOpen(modalId)) {
      this.close(modalId)
    } else {
      this.open(modalId)
    }
  }

  /**
   * Show loading overlay
   * @param {string} message - Loading message
   */
  showLoading(message = 'Cargando...') {
    let loader = document.getElementById('cl-global-loader')

    if (!loader) {
      loader = document.createElement('div')
      loader.id = 'cl-global-loader'
      loader.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50'
      loader.innerHTML = `
        <div class="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <span class="text-gray-700" id="cl-loader-message">${message}</span>
        </div>
      `
      document.body.appendChild(loader)
    } else {
      const messageEl = loader.querySelector('#cl-loader-message')
      if (messageEl) messageEl.textContent = message
      loader.classList.remove('hidden')
    }

    document.body.classList.add('overflow-hidden')
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const loader = document.getElementById('cl-global-loader')
    if (loader) {
      loader.classList.add('hidden')
    }
    if (this.openModals.size === 0) {
      document.body.classList.remove('overflow-hidden')
    }
  }

  /**
   * Show confirmation dialog
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} User choice
   */
  confirm({ title = 'Confirmar', message, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div')
      dialog.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50'
      dialog.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>
            <p class="text-gray-600">${message}</p>
          </div>
          <div class="flex justify-end gap-3 p-4 border-t">
            <button type="button" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50" data-action="cancel">
              ${cancelText}
            </button>
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
        dialog.remove()
      }

      dialog.addEventListener('click', handleClick)
      document.body.appendChild(dialog)
    })
  }
}

// Singleton instance
const overlay = new OverlayService()

// ============================================================
// EXPORTS
// ============================================================

export const Overlay = overlay

export function open(modalId, options) {
  return overlay.open(modalId, options)
}

export function close(modalId, result) {
  return overlay.close(modalId, result)
}

export function closeAll() {
  overlay.closeAll()
}

export function isOpen(modalId) {
  return overlay.isOpen(modalId)
}

export function toggle(modalId) {
  overlay.toggle(modalId)
}

export function showLoading(message) {
  overlay.showLoading(message)
}

export function hideLoading() {
  overlay.hideLoading()
}

export function confirm(options) {
  return overlay.confirm(options)
}

export default {
  Overlay,
  open,
  close,
  closeAll,
  isOpen,
  toggle,
  showLoading,
  hideLoading,
  confirm
}
