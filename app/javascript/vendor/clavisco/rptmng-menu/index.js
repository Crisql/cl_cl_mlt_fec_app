/**
 * @clavisco/rptmng-menu - Report management menu
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 *
 * Report manager menu for generating and viewing reports
 */

import { clPrint, CL_DISPLAY, Storage, downloadBase64File, printBase64File } from 'vendor/clavisco/core'
import { open as openOverlay } from 'vendor/clavisco/overlay'

// ============================================================
// REPORT SERVICE
// ============================================================

class ReportManagerService {
  constructor() {
    this.reports = []
    this.currentReport = null
  }

  /**
   * Load available reports
   * @param {string} module - Module name filter
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Array>} Reports list
   */
  async loadReports(module = '', apiUrl = '/api') {
    try {
      const url = module
        ? `${apiUrl}/Reports/GetByModule?module=${module}`
        : `${apiUrl}/Reports/GetAll`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.reports = data.Data || data || []
        return this.reports
      }

      return []

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return []
    }
  }

  /**
   * Generate report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report result
   */
  async generateReport(options) {
    try {
      const { reportId, parameters, format = 'pdf' } = options

      const response = await fetch('/api/Reports/Generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify({
          ReportId: reportId,
          Parameters: parameters,
          Format: format
        })
      })

      if (response.ok) {
        const data = await response.json()

        if (data.Data?.Base64File) {
          this.currentReport = data.Data
          return { success: true, data: data.Data }
        }

        return { success: true, data: data.Data || data }
      }

      const error = await response.json()
      throw new Error(error.Message || 'Error generating report')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Download current report
   * @param {string} fileName - File name
   */
  downloadReport(fileName = 'report') {
    if (!this.currentReport?.Base64File) {
      clPrint('No report to download', CL_DISPLAY.WARNING)
      return
    }

    downloadBase64File(
      this.currentReport.Base64File,
      fileName,
      this.currentReport.MimeType || 'application/pdf',
      this.currentReport.Extension || 'pdf'
    )
  }

  /**
   * Print current report
   * @param {boolean} newWindow - Open in new window
   */
  printReport(newWindow = false) {
    if (!this.currentReport?.Base64File) {
      clPrint('No report to print', CL_DISPLAY.WARNING)
      return
    }

    printBase64File({
      base64File: this.currentReport.Base64File,
      blobType: this.currentReport.MimeType || 'application/pdf',
      onNewWindow: newWindow
    })
  }

  /**
   * Preview report in modal
   * @param {string} modalId - Modal element ID
   */
  previewReport(modalId = 'report-preview-modal') {
    if (!this.currentReport?.Base64File) {
      clPrint('No report to preview', CL_DISPLAY.WARNING)
      return
    }

    // Create blob URL
    const byteCharacters = atob(this.currentReport.Base64File)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: this.currentReport.MimeType || 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)

    // Open modal with preview
    openOverlay(modalId, {
      reportUrl: blobUrl,
      report: this.currentReport
    })
  }

  /**
   * Get available reports
   * @returns {Array} Reports list
   */
  getReports() {
    return this.reports
  }

  /**
   * Get current report
   * @returns {Object|null} Current report
   */
  getCurrentReport() {
    return this.currentReport
  }

  /**
   * Clear current report
   */
  clearReport() {
    this.currentReport = null
  }

  /**
   * Send report by email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendByEmail(options) {
    try {
      const { to, subject, body, reportId, parameters } = options

      const response = await fetch('/api/Reports/SendByEmail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify({
          To: to,
          Subject: subject,
          Body: body,
          ReportId: reportId,
          Parameters: parameters
        })
      })

      if (response.ok) {
        return { success: true }
      }

      const error = await response.json()
      throw new Error(error.Message || 'Error sending email')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }
}

// Singleton instance
const reportManager = new ReportManagerService()

// ============================================================
// EXPORTS
// ============================================================

export const ReportManager = reportManager

export function loadReports(module, apiUrl) {
  return reportManager.loadReports(module, apiUrl)
}

export function generateReport(options) {
  return reportManager.generateReport(options)
}

export function downloadReport(fileName) {
  reportManager.downloadReport(fileName)
}

export function printReport(newWindow) {
  reportManager.printReport(newWindow)
}

export function previewReport(modalId) {
  reportManager.previewReport(modalId)
}

export function getReports() {
  return reportManager.getReports()
}

export function getCurrentReport() {
  return reportManager.getCurrentReport()
}

export function clearReport() {
  reportManager.clearReport()
}

export function sendByEmail(options) {
  return reportManager.sendByEmail(options)
}

export default {
  ReportManager,
  loadReports,
  generateReport,
  downloadReport,
  printReport,
  previewReport,
  getReports,
  getCurrentReport,
  clearReport,
  sendByEmail
}
