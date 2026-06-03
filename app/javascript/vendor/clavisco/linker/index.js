/**
 * @clavisco/linker - Event-based communication between components
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 *
 * Provides Pub/Sub pattern for component communication
 */

import { clPrint, CL_DISPLAY } from 'vendor/clavisco/core'

// ============================================================
// EVENT INTERFACE
// ============================================================

/**
 * @typedef {Object} ICLEvent
 * @property {string} View - Target view/component route
 * @property {string} [Target] - Optional function name to call
 * @property {any} Data - Event data payload
 */

// ============================================================
// LINKER SERVICE
// ============================================================

class LinkerService {
  constructor() {
    this.subscribers = new Map()
    this.eventTarget = new EventTarget()
  }

  /**
   * Publish an event to all listeners
   * @param {ICLEvent} event - Event object to publish
   */
  publish(event) {
    try {
      if (!event) {
        throw new Error('Event is null or undefined')
      }

      // Dispatch using EventTarget
      const customEvent = new CustomEvent('cl-event', { detail: event })
      this.eventTarget.dispatchEvent(customEvent)

      // Also dispatch to document for cross-controller communication
      document.dispatchEvent(new CustomEvent('cl-linker', { detail: event }))

      // Notify specific view subscribers
      if (event.View && this.subscribers.has(event.View)) {
        this.subscribers.get(event.View).forEach(callback => {
          try {
            callback(event)
          } catch (err) {
            clPrint(`Error in subscriber callback: ${err}`, CL_DISPLAY.ERROR)
          }
        })
      }

      // Notify wildcard subscribers
      if (this.subscribers.has('*')) {
        this.subscribers.get('*').forEach(callback => {
          try {
            callback(event)
          } catch (err) {
            clPrint(`Error in wildcard subscriber: ${err}`, CL_DISPLAY.ERROR)
          }
        })
      }

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
    }
  }

  /**
   * Subscribe to events for a specific view
   * @param {string} view - View/component identifier (use '*' for all)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(view, callback) {
    if (!this.subscribers.has(view)) {
      this.subscribers.set(view, new Set())
    }

    this.subscribers.get(view).add(callback)

    // Return unsubscribe function
    return () => {
      const viewSubscribers = this.subscribers.get(view)
      if (viewSubscribers) {
        viewSubscribers.delete(callback)
        if (viewSubscribers.size === 0) {
          this.subscribers.delete(view)
        }
      }
    }
  }

  /**
   * Subscribe to all events using EventTarget
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  flow(callback) {
    const handler = (event) => callback(event.detail)
    this.eventTarget.addEventListener('cl-event', handler)

    return () => {
      this.eventTarget.removeEventListener('cl-event', handler)
    }
  }

  /**
   * Clear all subscribers
   */
  clear() {
    this.subscribers.clear()
  }

  /**
   * Get subscriber count for a view
   * @param {string} view - View identifier
   * @returns {number} Number of subscribers
   */
  subscriberCount(view) {
    return this.subscribers.get(view)?.size || 0
  }
}

// Singleton instance
const linker = new LinkerService()

// ============================================================
// EXPORTS
// ============================================================

/**
 * Publish an event
 * @param {ICLEvent} event - Event to publish
 */
export function publish(event) {
  linker.publish(event)
}

/**
 * Subscribe to events for a view
 * @param {string} view - View identifier
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(view, callback) {
  return linker.subscribe(view, callback)
}

/**
 * Subscribe to all events
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function flow(callback) {
  return linker.flow(callback)
}

/**
 * Clear all subscribers
 */
export function clear() {
  linker.clear()
}

// Export singleton
export const Linker = linker

// Default export
export default {
  publish,
  subscribe,
  flow,
  clear,
  Linker
}
