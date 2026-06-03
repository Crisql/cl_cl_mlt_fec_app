import { Controller } from "@hotwired/stimulus"
import { getAPIHeaders } from "lib/api_helpers"
import { ReportManager } from "vendor/clavisco/rptmng-menu"

/**
 * Report Management Desk Controller
 * Handles the report viewer and desk functionality for Rails + Stimulus
 * Migrated from Angular @clavisco/rptmng-desk library
 *
 * Features:
 * - Load and display available reports
 * - Select reports and show their parameters
 * - Generate reports with parameters
 * - Download, print, preview, and send reports by email
 * - Support for multiple parameter types (date, text, select, checkbox)
 */
export default class extends Controller {
  static targets = [
    "reportsList",
    "selectedReportName",
    "selectedReportDescription",
    "parametersForm",
    "generateBtn",
    "downloadBtn",
    "printBtn",
    "previewBtn",
    "sendEmailBtn",
    "refreshBtn",
    "loading",
    "emptyState",
    "reportDetails"
  ]

  static values = {
    module: String,
    apiUrl: { type: String, default: "/api" }
  }

  connect() {
    this.reports = []
    this.selectedReport = null
    this.currentReportResult = null
    this.isLoading = false

    // Listen for rptmng-desk:open events from the principal controller
    this.boundHandleOpen = (event) => this.handleOpenEvent(event)
    window.addEventListener("rptmng-desk:open", this.boundHandleOpen)

    // Initialize and check URL params
    this.loadReports().then(() => this.checkUrlParams())
  }

  // Check URL params for direct report opening (from navigation)
  checkUrlParams() {
    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('reportId')
    if (reportId) {
      const report = this.reports.find(r => (r.Id || r.ReportId) == reportId)
      if (report) {
        this.selectedReport = report
        this.updateSelectedReportDisplay()
        this.renderParametersForm()
        this.updateActionButtons()
      }
    }
  }

  disconnect() {
    if (this.boundHandleOpen) {
      window.removeEventListener("rptmng-desk:open", this.boundHandleOpen)
    }
  }

  // Handle open event from principal controller (menu report click)
  handleOpenEvent(event) {
    const { reportId, reportName } = event.detail || {}
    if (reportId) {
      // Find and select the report
      const report = this.reports.find(r => (r.Id || r.ReportId) == reportId)
      if (report) {
        this.selectedReport = report
        this.updateSelectedReportDisplay()
        this.renderParametersForm()
        this.updateActionButtons()
        ReportManager.currentReport = this.selectedReport
      } else {
        // Report not loaded yet, try reloading
        this.loadReports().then(() => {
          const retryReport = this.reports.find(r => (r.Id || r.ReportId) == reportId)
          if (retryReport) {
            this.selectedReport = retryReport
            this.updateSelectedReportDisplay()
            this.renderParametersForm()
            this.updateActionButtons()
          }
        })
      }
    }
  }

  /**
   * Load available reports from the API
   */
  async loadReports() {
    this.isLoading = true
    this.showLoading(true)

    try {
      const url = this.moduleValue
        ? `${this.apiUrlValue}/Reports/GetByModule?module=${this.moduleValue}`
        : `${this.apiUrlValue}/Reports/GetReports`

      const response = await fetch(url, {
        headers: getAPIHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.reports = data.Data || data || []

        // Store in ReportManager service for consistency
        ReportManager.reports = this.reports

        this.renderReports()
        this.showEmptyState(this.reports.length === 0)
      } else {
        console.error("Error loading reports:", response.statusText)
        this.showEmptyState(true)
      }
    } catch (error) {
      console.error("Error loading reports:", error)
      this.showEmptyState(true)
    } finally {
      this.isLoading = false
      this.showLoading(false)
    }
  }

  /**
   * Render the reports list/grid
   */
  renderReports() {
    if (this.reports.length === 0) {
      this.reportsListTarget.innerHTML = ""
      return
    }

    this.reportsListTarget.innerHTML = this.reports
      .map(
        (report) => `
      <div class="report-card p-4 border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
           data-report-id="${report.Id}"
           data-action="click->rptmng-desk#selectReport">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <span class="material-icons text-blue-600 text-2xl">
              ${this.getReportIcon(report.Type || report.ReportType)}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-gray-900 truncate">
              ${report.Name || report.ReportName}
            </h3>
            <p class="text-xs text-gray-500 mt-1 line-clamp-2">
              ${report.Description || "No description available"}
            </p>
            ${report.Module ? `<span class="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">${report.Module}</span>` : ""}
          </div>
        </div>
      </div>
    `
      )
      .join("")
  }

  /**
   * Get appropriate material icon for report type
   */
  getReportIcon(reportType) {
    const iconMap = {
      pdf: "picture_as_pdf",
      excel: "table_chart",
      csv: "description",
      html: "language",
      default: "assessment"
    }

    if (!reportType) return iconMap.default

    const type = String(reportType).toLowerCase()
    return iconMap[type] || iconMap.default
  }

  /**
   * Handle report selection
   */
  selectReport(event) {
    const card = event.currentTarget.closest("[data-report-id]")
    if (!card) return

    const reportId = card.getAttribute("data-report-id")
    this.selectedReport = this.reports.find((r) => r.Id === reportId)

    if (!this.selectedReport) return

    // Update UI
    this.updateSelectedReportDisplay()
    this.renderParametersForm()
    this.updateActionButtons()

    // Store in ReportManager
    ReportManager.currentReport = this.selectedReport
  }

  /**
   * Update selected report display
   */
  updateSelectedReportDisplay() {
    if (!this.selectedReport) return

    this.selectedReportNameTarget.textContent = this.selectedReport.Name || this.selectedReport.ReportName
    this.selectedReportDescriptionTarget.textContent = this.selectedReport.Description || ""
    this.reportDetailsTarget.classList.remove("hidden")
  }

  /**
   * Render parameters form based on selected report
   */
  renderParametersForm() {
    if (!this.selectedReport || !this.selectedReport.Parameters) {
      this.parametersFormTarget.innerHTML =
        '<p class="text-sm text-gray-500">No parameters required for this report</p>'
      return
    }

    const parameters = this.selectedReport.Parameters
    if (!Array.isArray(parameters) || parameters.length === 0) {
      this.parametersFormTarget.innerHTML =
        '<p class="text-sm text-gray-500">No parameters required for this report</p>'
      return
    }

    this.parametersFormTarget.innerHTML = parameters
      .map((param) => this.renderParameterField(param))
      .join("")
  }

  /**
   * Render a single parameter field based on type
   */
  renderParameterField(param) {
    const paramId = `param-${param.Name || param.ParameterName}`
    const label = param.Label || param.Name || param.ParameterName
    const isRequired = param.Required || param.IsRequired

    let fieldHTML = ""

    const paramType = (param.Type || param.ParameterType || "text").toLowerCase()

    switch (paramType) {
      case "date":
      case "datetime":
        fieldHTML = `
        <div class="mb-4">
          <label for="${paramId}" class="block text-sm font-medium text-gray-700 mb-1">
            ${label}
            ${isRequired ? '<span class="text-red-500">*</span>' : ""}
          </label>
          <input type="date"
                 id="${paramId}"
                 name="${param.Name || param.ParameterName}"
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 ${isRequired ? "required" : ""}
                 ${param.DefaultValue ? `value="${this.formatDateForInput(param.DefaultValue)}"` : ""}>
        </div>
      `
        break

      case "select":
      case "dropdown":
        const options = param.Options || param.SelectOptions || []
        fieldHTML = `
        <div class="mb-4">
          <label for="${paramId}" class="block text-sm font-medium text-gray-700 mb-1">
            ${label}
            ${isRequired ? '<span class="text-red-500">*</span>' : ""}
          </label>
          <select id="${paramId}"
                  name="${param.Name || param.ParameterName}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ${isRequired ? "required" : ""}>
            <option value="">-- Select ${label} --</option>
            ${options
              .map(
                (opt) => `
              <option value="${opt.Value || opt}"
                      ${param.DefaultValue === (opt.Value || opt) ? "selected" : ""}>
                ${opt.Label || opt.Name || opt}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
      `
        break

      case "checkbox":
      case "boolean":
        fieldHTML = `
        <div class="mb-4 flex items-center">
          <input type="checkbox"
                 id="${paramId}"
                 name="${param.Name || param.ParameterName}"
                 class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                 ${param.DefaultValue === true || param.DefaultValue === "true" ? "checked" : ""}>
          <label for="${paramId}" class="ml-2 block text-sm text-gray-700">
            ${label}
            ${isRequired ? '<span class="text-red-500">*</span>' : ""}
          </label>
        </div>
      `
        break

      case "text":
      case "string":
      default:
        fieldHTML = `
        <div class="mb-4">
          <label for="${paramId}" class="block text-sm font-medium text-gray-700 mb-1">
            ${label}
            ${isRequired ? '<span class="text-red-500">*</span>' : ""}
          </label>
          <input type="text"
                 id="${paramId}"
                 name="${param.Name || param.ParameterName}"
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="${param.Placeholder || ""}"
                 ${isRequired ? "required" : ""}
                 ${param.DefaultValue ? `value="${param.DefaultValue}"` : ""}>
        </div>
      `
    }

    return fieldHTML
  }

  /**
   * Format date string for HTML input[type=date]
   */
  formatDateForInput(dateStr) {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ""
    return date.toISOString().split("T")[0]
  }

  /**
   * Collect parameters from form
   */
  collectParameters() {
    const formElements = this.parametersFormTarget.querySelectorAll("[name]")
    const parameters = {}

    formElements.forEach((element) => {
      const name = element.getAttribute("name")
      if (element.type === "checkbox") {
        parameters[name] = element.checked
      } else {
        parameters[name] = element.value
      }
    })

    return parameters
  }

  /**
   * Generate report with current parameters
   */
  async generateReport() {
    if (!this.selectedReport) return

    const parameters = this.collectParameters()

    this.showLoading(true)
    this.generateBtnTarget.disabled = true

    try {
      const response = await fetch(`${this.apiUrlValue}/Reports/Generate`, {
        method: "POST",
        headers: getAPIHeaders(),
        body: JSON.stringify({
          ReportId: this.selectedReport.Id,
          Parameters: parameters,
          Format: this.selectedReport.DefaultFormat || "pdf"
        })
      })

      if (response.ok) {
        const data = await response.json()
        this.currentReportResult = data.Data || data

        // Store in ReportManager for consistency
        ReportManager.currentReport = this.currentReportResult

        this.updateActionButtons(true)
        this.showSuccessMessage("Report generated successfully")
      } else {
        const error = await response.json()
        this.showErrorMessage(error.Message || "Error generating report")
      }
    } catch (error) {
      console.error("Error generating report:", error)
      this.showErrorMessage("Error generating report: " + error.message)
    } finally {
      this.showLoading(false)
      this.generateBtnTarget.disabled = false
    }
  }

  /**
   * Download the current report
   */
  async downloadReport() {
    if (!this.currentReportResult?.Base64File) {
      this.showErrorMessage("No report available to download")
      return
    }

    try {
      const base64 = this.currentReportResult.Base64File
      const mimeType = this.currentReportResult.MimeType || "application/pdf"
      const extension = this.currentReportResult.Extension || "pdf"
      const fileName = `${this.selectedReport?.Name || "report"}.${extension}`

      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      this.showSuccessMessage("Report downloaded")
    } catch (error) {
      console.error("Error downloading report:", error)
      this.showErrorMessage("Error downloading report")
    }
  }

  /**
   * Print the current report
   */
  printReport() {
    if (!this.currentReportResult?.Base64File) {
      this.showErrorMessage("No report available to print")
      return
    }

    try {
      const base64 = this.currentReportResult.Base64File
      const mimeType = this.currentReportResult.MimeType || "application/pdf"

      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, "_blank")

      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print()
        })
      }
    } catch (error) {
      console.error("Error printing report:", error)
      this.showErrorMessage("Error printing report")
    }
  }

  /**
   * Preview the current report
   */
  previewReport() {
    if (!this.currentReportResult?.Base64File) {
      this.showErrorMessage("No report available to preview")
      return
    }

    try {
      const base64 = this.currentReportResult.Base64File
      const mimeType = this.currentReportResult.MimeType || "application/pdf"

      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
    } catch (error) {
      console.error("Error previewing report:", error)
      this.showErrorMessage("Error previewing report")
    }
  }

  /**
   * Send the current report by email
   */
  async sendByEmail() {
    if (!this.selectedReport) {
      this.showErrorMessage("No report selected")
      return
    }

    // Show email form dialog
    const emailTo = prompt("Enter recipient email address:")
    if (!emailTo) return

    const subject = prompt("Enter email subject:", this.selectedReport.Name || "Report")
    if (subject === null) return

    const body = prompt("Enter email body (optional):", "")

    this.showLoading(true)
    this.sendEmailBtnTarget.disabled = true

    try {
      const response = await fetch(`${this.apiUrlValue}/Reports/SendByEmail`, {
        method: "POST",
        headers: getAPIHeaders(),
        body: JSON.stringify({
          To: emailTo,
          Subject: subject,
          Body: body || "",
          ReportId: this.selectedReport.Id,
          Parameters: this.collectParameters()
        })
      })

      if (response.ok) {
        this.showSuccessMessage("Report sent successfully")
      } else {
        const error = await response.json()
        this.showErrorMessage(error.Message || "Error sending email")
      }
    } catch (error) {
      console.error("Error sending email:", error)
      this.showErrorMessage("Error sending email: " + error.message)
    } finally {
      this.showLoading(false)
      this.sendEmailBtnTarget.disabled = false
    }
  }

  /**
   * Refresh the reports list
   */
  refreshReports() {
    this.selectedReport = null
    this.currentReportResult = null
    this.updateSelectedReportDisplay()
    this.renderParametersForm()
    this.updateActionButtons()
    this.loadReports()
  }

  /**
   * Update action button states based on report availability
   */
  updateActionButtons(reportGenerated = false) {
    const hasReport = !!this.currentReportResult?.Base64File

    this.downloadBtnTarget.disabled = !hasReport
    this.printBtnTarget.disabled = !hasReport
    this.previewBtnTarget.disabled = !hasReport
  }

  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.toggle("hidden", !show)
    }
  }

  /**
   * Show/hide empty state
   */
  showEmptyState(show) {
    if (this.hasEmptyStateTarget) {
      this.emptyStateTarget.classList.toggle("hidden", !show)
    }
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    // You can integrate with a toast notification library here
    console.log("Success:", message)
    if (window.showNotification) {
      window.showNotification(message, "success")
    }
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    // You can integrate with a toast notification library here
    console.error("Error:", message)
    if (window.showNotification) {
      window.showNotification(message, "error")
    }
  }
}
