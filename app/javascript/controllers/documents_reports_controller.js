import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';

/**
 * DocumentsReportsController — Reportes de documentos emitidos y recepcionados.
 *
 * Replica: pages/reports/reports.component.ts (Angular legacy, ruta /docReport)
 * Ruta Rails: /documents-reports
 *
 * Funcionalidad:
 *   - Filtro por StartDate / EndDate con botones "Hoy"
 *   - Radio buttons por tipo de reporte (visibles según permisos)
 *   - Validación de fechas (no nulas, no futuras, StartDate ≤ EndDate)
 *   - GET /api/Report/GetDocReport      → PDF base64 → nueva pestaña
 *   - GET /api/Report/GetDocReceptReport → PDF base64 → nueva pestaña
 *   - Overlay durante la carga
 *   - Toast warning cuando no hay datos
 *   - Toast error cuando la API falla
 */
export default class extends Controller {
  static targets = [
    'startDate',
    'endDate',
    'radioDocWrapper',
    'radioRecepWrapper',
    'submitBtn',
    'overlay',
    'validationModal',
    'modalMessage',
    'pageTitle',
  ]

  // ── Permisos ──────────────────────────────────────────────────────────────
  #permissions = []
  #companyId   = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    this.#permissions = SStore.get('Permissions') || []
    const company     = SStore.get('CurrentCompany') || {}
    this.#companyId   = company.companyId ?? null

    this.#initDefaults()
    this.#applyPermissions()
    this.#updateSubmitState()
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  #initDefaults() {
    const today = this.#formatDate(new Date())
    this.startDateTarget.value = today
    this.endDateTarget.value   = today
  }

  #applyPermissions() {
    const hasDoc   = this.#hasPerm('S_DocumentReport')
    const hasRecep = this.#hasPerm('S_DocumentReceptionReport')

    if (hasDoc) {
      this.radioDocWrapperTarget.classList.remove('hidden')
      this.radioDocWrapperTarget.classList.add('flex')
      // Seleccionar por defecto
      const radio = this.radioDocWrapperTarget.querySelector('input[type="radio"]')
      if (radio) radio.checked = true
      this.#setTitle('Reporte de Documentos')
    }

    if (hasRecep) {
      this.radioRecepWrapperTarget.classList.remove('hidden')
      this.radioRecepWrapperTarget.classList.add('flex')
      // Si no tiene S_DocumentReport, seleccionar recepción por defecto
      if (!hasDoc) {
        const radio = this.radioRecepWrapperTarget.querySelector('input[type="radio"]')
        if (radio) radio.checked = true
        this.#setTitle('Reporte de Documentos Recepcionados')
      }
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  setTodayStart() {
    this.startDateTarget.value = this.#formatDate(new Date())
    this.#updateSubmitState()
  }

  setTodayEnd() {
    this.endDateTarget.value = this.#formatDate(new Date())
    this.#updateSubmitState()
  }

  validateDates() {
    this.#updateSubmitState()
  }

  onReportTypeChange(event) {
    const value = event.target.value
    if (value === '1') {
      this.#setTitle('Reporte de Documentos')
    } else {
      this.#setTitle('Reporte de Documentos Recepcionados')
    }
  }

  submit() {
    const startDate = this.startDateTarget.value
    const endDate   = this.endDateTarget.value

    if (!startDate || !endDate) {
      this.#showModal('El formulario no puede enviarse con campos vacíos. Complete todos los campos antes de continuar.')
      return
    }

    const start = new Date(startDate)
    const end   = new Date(endDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    if (start > today || end > today || start > end) {
      this.#showModal('La fecha de búsqueda es futura o la fecha de inicio es posterior a la fecha final. Por favor, verifica y ajusta las fechas para asegurarte de que el rango de búsqueda sea válido.')
      return
    }

    const reportType = this.#selectedReportType()
    if (reportType === '1') {
      this.#fetchReport('GetDocReport', startDate, endDate)
    } else {
      this.#fetchReport('GetDocReceptReport', startDate, endDate)
    }
  }

  closeModal() {
    this.validationModalTarget.classList.add('hidden')
  }

  // ── API ───────────────────────────────────────────────────────────────────

  async #fetchReport(endpoint, startDate, endDate) {
    this.#showOverlay()
    try {
      const companyId = this.#companyId
      const url = `/api/Report/${endpoint}?StartDate=${startDate}&EndDate=${endDate}&CompanyId=${companyId}`
      const data = await this.#apiFetch(url)

      if (data?.Data) {
        this.#openPdfInNewTab(data.Data)
      } else {
        showToast('Lo sentimos, no hay información disponible para generar el reporte en el rango de fechas proporcionados', 'warning')
      }
    } catch (err) {
      showToast(err.message || 'Error al generar el reporte', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  async #apiFetch(url, options = {}) {
    const session   = Storage.get('Session') || {}
    const token     = session.access_token
    const company   = SStore.get('CurrentCompany') || {}
    const companyId = company.companyId ?? this.#companyId

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type':             'application/json',
        'API':                      'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token     ? { Authorization:   `Bearer ${token}` } : {}),
        ...(companyId ? { 'Cl-Company-Id': String(companyId) } : {}),
        ...(options.headers || {}),
      },
    })

    const clMessage = response.headers.get('cl-message')
    const decodedMessage = clMessage ? (() => {
      try { return decodeURIComponent(clMessage) } catch { return clMessage }
    })() : null

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(decodedMessage || text || `HTTP ${response.status}`)
    }

    const hasBody = response.status !== 204 &&
                    response.headers.get('content-length') !== '0' &&
                    response.headers.get('content-type')?.includes('application/json')
    if (!hasBody) return { Message: decodedMessage || null }

    const json = await response.json()
    if (decodedMessage && !json.Message) json.Message = decodedMessage
    return json
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  #openPdfInNewTab(base64) {
    const binary      = atob(base64)
    const arrayBuffer = new ArrayBuffer(binary.length)
    const uintArray   = new Uint8Array(arrayBuffer)
    for (let i = 0; i < binary.length; i++) {
      uintArray[i] = binary.charCodeAt(i)
    }
    const blob    = new Blob([uintArray], { type: 'application/pdf' })
    const fileUrl = URL.createObjectURL(blob)
    const tab     = window.open()
    if (tab) tab.location.href = fileUrl
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  #hasPerm(name) {
    return this.#permissions.includes(name)
  }

  #formatDate(date) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  #selectedReportType() {
    const checked = this.element.querySelector('input[name="report_type"]:checked')
    return checked ? checked.value : '1'
  }

  #setTitle(text) {
    if (this.hasPageTitleTarget) this.pageTitleTarget.textContent = text
  }

  #updateSubmitState() {
    const valid = this.startDateTarget.value && this.endDateTarget.value
    this.submitBtnTarget.disabled = !valid
  }

  #showOverlay() {
    this.overlayTarget.classList.remove('hidden')
  }

  #hideOverlay() {
    this.overlayTarget.classList.add('hidden')
  }

  #showModal(message) {
    this.modalMessageTarget.textContent = message
    this.validationModalTarget.classList.remove('hidden')
  }
}
