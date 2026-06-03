/**
 * @clavisco/pinpad - Pinpad integration service
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

import { clPrint, CL_DISPLAY, Storage } from 'vendor/clavisco/core'
import { publish } from 'vendor/clavisco/linker'

// ============================================================
// PINPAD SERVICE
// ============================================================

class PinpadService {
  constructor() {
    this.isConnected = false
    this.terminal = null
    this.config = null
  }

  /**
   * Initialize pinpad connection
   * @param {Object} config - Pinpad configuration
   */
  async initialize(config) {
    try {
      this.config = config

      // Get pinpad configuration from API
      const response = await fetch('/api/Pinpad/GetConfiguration', {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.terminal = data.Data || data
        this.isConnected = true

        publish({
          View: 'pinpad',
          Target: 'initialized',
          Data: this.terminal
        })

        return { success: true, terminal: this.terminal }
      }

      throw new Error('Failed to initialize pinpad')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Process payment through pinpad
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    try {
      if (!this.isConnected) {
        throw new Error('Pinpad not connected')
      }

      const response = await fetch('/api/Pinpad/ProcessPayment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify({
          Amount: paymentData.amount,
          Currency: paymentData.currency || 'CRC',
          TerminalId: this.terminal?.Id,
          Reference: paymentData.reference,
          ...paymentData
        })
      })

      const data = await response.json()

      if (data.Result || data.Success) {
        publish({
          View: 'pinpad',
          Target: 'paymentSuccess',
          Data: data.Data || data
        })

        return { success: true, data: data.Data || data }
      }

      throw new Error(data.Error?.Message || 'Payment failed')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)

      publish({
        View: 'pinpad',
        Target: 'paymentError',
        Data: { error: error.message }
      })

      return { success: false, error: error.message }
    }
  }

  /**
   * Get pinpad totals
   * @returns {Promise<Object>} Totals data
   */
  async getTotals() {
    try {
      const response = await fetch('/api/Pinpad/GetTotals', {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, data: data.Data || data }
      }

      throw new Error('Failed to get totals')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Close pinpad batch
   * @returns {Promise<Object>} Close result
   */
  async closeBatch() {
    try {
      const response = await fetch('/api/Pinpad/CloseBatch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, data: data.Data || data }
      }

      throw new Error('Failed to close batch')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Void transaction
   * @param {string} transactionId - Transaction to void
   * @returns {Promise<Object>} Void result
   */
  async voidTransaction(transactionId) {
    try {
      const response = await fetch('/api/Pinpad/VoidTransaction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify({ TransactionId: transactionId })
      })

      if (response.ok) {
        const data = await response.json()
        return { success: true, data: data.Data || data }
      }

      throw new Error('Failed to void transaction')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Check connection status
   * @returns {boolean} Connection status
   */
  checkConnection() {
    return this.isConnected
  }

  /**
   * Disconnect from pinpad
   */
  disconnect() {
    this.isConnected = false
    this.terminal = null

    publish({
      View: 'pinpad',
      Target: 'disconnected',
      Data: null
    })
  }
}

// Singleton instance
const pinpad = new PinpadService()

// ============================================================
// EXPORTS
// ============================================================

export const Pinpad = pinpad

export function initialize(config) {
  return pinpad.initialize(config)
}

export function processPayment(paymentData) {
  return pinpad.processPayment(paymentData)
}

export function getTotals() {
  return pinpad.getTotals()
}

export function closeBatch() {
  return pinpad.closeBatch()
}

export function voidTransaction(transactionId) {
  return pinpad.voidTransaction(transactionId)
}

export function checkConnection() {
  return pinpad.checkConnection()
}

export function disconnect() {
  pinpad.disconnect()
}

export default {
  Pinpad,
  initialize,
  processPayment,
  getTotals,
  closeBatch,
  voidTransaction,
  checkConnection,
  disconnect
}
