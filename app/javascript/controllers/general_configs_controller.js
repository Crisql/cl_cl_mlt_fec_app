import { Controller } from '@hotwired/stimulus'
import { Storage, SStore } from 'vendor/clavisco/core'

/**
 * GeneralConfigsController — Configuraciones Generales.
 *
 * Equivalente Angular:
 *   - GeneralConfigsComponent (pages/general-configs/)
 *
 * Responsabilidades:
 *   - Cargar GeneralConfigs (GET api/GeneralConfigs/GetGeneralConfigs)
 *   - Cargar Setting CedulaProveedorSistemas (GET api/settings)
 *   - Upload de formato .rpt (PATCH api/GeneralConfigs?generalConfigsId={id})
 *   - Download de formato .rpt (GET api/GeneralConfigs/default-print-format)
 *   - Actualizar cédula (PATCH api/settings)
 *   - Control de visibilidad por permisos
 */
export default class extends Controller {
  static targets = [
    'printFormatInput',
    'fileInput',
    'printFormatError',
    'uploadWrapper',
    'downloadWrapper',
    'updateFormatWrapper',
    'btnUpdateFormat',
    'cedulaInput',
  ]

  // ----------------------------------------------------------------
  // Estado privado
  // ----------------------------------------------------------------
  #generalConfigId = null
  #selectedFile    = null

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  connect() {
    this.#setupPermissions()
    this.#loadAll()
  }

  // ----------------------------------------------------------------
  // Setup permisos
  // ----------------------------------------------------------------
  #setupPermissions() {
    const perms = SStore.get('Permissions') || []

    const canUpload   = perms.includes('Configurations_General_UploadDefaultPrintFormat')
    const canDownload = perms.includes('Configurations_General_DownloadDefaultPrintFormat')

    if (canUpload) {
      this.uploadWrapperTarget.classList.remove('hidden')
      this.updateFormatWrapperTarget.classList.remove('hidden')
    }

    if (canDownload) {
      this.downloadWrapperTarget.classList.remove('hidden')
    }
  }

  // ----------------------------------------------------------------
  // Carga inicial
  // ----------------------------------------------------------------
  async #loadAll() {
    this.#showOverlay('Cargando configuraciones...')
    try {
      await Promise.all([
        this.#loadGeneralConfigs(),
        this.#loadSettings(),
      ])
    } finally {
      this.#hideOverlay()
    }
  }

  async #loadGeneralConfigs() {
    try {
      const data = await this.#apiFetch('/api/GeneralConfigs/GetGeneralConfigs')

      if (data.Data && data.Data.length > 0) {
        const config = data.Data[0]
        this.#generalConfigId = config.Id

        const fullPath = config.DefaultPrintFormatPath || ''
        const fileName = fullPath ? fullPath.split('\\').at(-1) : ''
        this.printFormatInputTarget.value = fileName

        this.#showToast('Configuraciones generales obtenidos con éxito!!!', 'success')
      } else {
        this.#showToast(data.Message || 'No se encontraron configuraciones', 'warning')
      }
    } catch (err) {
      this.#showToast(err.message || 'Error al cargar configuraciones generales', 'error')
    }
  }

  async #loadSettings() {
    try {
      const data = await this.#apiFetch('/api/settings')

      if (data.Data) {
        const setting = data.Data.find(s => s.Code === 'CedulaProveedorSistemas')
        if (setting) {
          this.cedulaInputTarget.value = setting.Json
        }
      } else {
        this.#showToast(data.Message || 'No se pudieron cargar los ajustes', 'warning')
      }
    } catch (err) {
      this.#showToast(err.message || 'Error al cargar ajustes', 'error')
    }
  }

  // ----------------------------------------------------------------
  // Upload: selección de archivo
  // ----------------------------------------------------------------
  triggerFileInput() {
    this.fileInputTarget.click()
  }

  onFileSelected(event) {
    const file = event.target.files[0]
    this.#selectedFile = null
    this.printFormatInputTarget.value = ''
    this.btnUpdateFormatTarget.disabled = true
    this.printFormatErrorTarget.classList.add('hidden')

    if (!file) return

    const validExtension = /\.rpt$/i.test(file.name)
    if (!validExtension) {
      this.#showToast(
        'Por favor selecione un formato de impresión válido para continuar, gracias!!!',
        'error'
      )
      this.printFormatErrorTarget.classList.remove('hidden')
      // Limpiar el file input para permitir re-selección
      this.fileInputTarget.value = ''
      return
    }

    this.#selectedFile = file
    this.printFormatInputTarget.value = file.name
    this.btnUpdateFormatTarget.disabled = false
  }

  // ----------------------------------------------------------------
  // Actualizar formato de impresión
  // ----------------------------------------------------------------
  async updatePrintFormat() {
    if (!this.#selectedFile || !this.#generalConfigId) return

    this.#showOverlay('Editando la configuración general, espere por favor...')

    const formData = new FormData()
    formData.append('filePrintFormat', this.#selectedFile)

    try {
      await this.#apiFetch(
        `/api/GeneralConfigs?generalConfigsId=${this.#generalConfigId}`,
        {
          method: 'PATCH',
          headers: { 'Request-With-Files': 'true' },
          body: formData,
        }
      )

      this.#showToast('Configuración general editada con éxito!!!', 'success')
      this.#selectedFile = null
      this.fileInputTarget.value = ''
      this.btnUpdateFormatTarget.disabled = true

      // Recargar para mostrar el nombre actualizado
      await this.#loadGeneralConfigs()
    } catch (err) {
      this.#showToast(err.message || 'Error al actualizar el formato de impresión', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // Download formato de impresión
  // ----------------------------------------------------------------
  async downloadPrintFormat() {
    this.#showOverlay('Descargando formato de impresión predeterminado...')

    try {
      const session  = Storage.get('Session') || {}
      const token    = session.access_token
      const response = await fetch('/api/GeneralConfigs/default-print-format', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        // Intentar parsear body como JSON para extraer mensaje de error
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const err = await response.json()
          throw new Error(err.Message || `HTTP ${response.status}`)
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const blob     = await response.blob()
      const fileName = this.printFormatInputTarget.value || 'formato-impresion.rpt'
      const url      = window.URL.createObjectURL(blob)
      const link     = document.createElement('a')
      link.href      = url
      link.download  = fileName
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      this.#showToast(err.message || 'Error al descargar el formato de impresión', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // Actualizar Cédula Proveedor Sistemas
  // ----------------------------------------------------------------
  async updateCedula() {
    const value = this.cedulaInputTarget.value

    this.#showOverlay('Actualizando cédula proveedor sistemas, espere por favor...')

    try {
      const session = Storage.get('Session') || {}
      const feSyncToken = session.access_token

      await this.#apiFetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization-FESync': feSyncToken || '',
        },
        body: JSON.stringify({
          Code:     'CedulaProveedorSistemas',
          Json:     value,
          IsActive: true,
        }),
      })

      this.#showToast('Cédula proveedor sistemas actualizada con éxito!!!', 'success')
      await this.#loadSettings()
    } catch (err) {
      this.#showToast(err.message || 'Error al actualizar cédula', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // Helpers: API
  // ----------------------------------------------------------------
  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {}
    const token   = session.access_token

    // Para FormData no setear Content-Type (el browser lo pone con boundary)
    const isFormData = options.body instanceof FormData
    const defaultHeaders = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `HTTP ${response.status}`)
    }

    const contentType   = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length')
    if (contentLength === '0' || (!contentType.includes('json') && !contentType.includes('text'))) {
      return {}
    }
    const text = await response.text()
    if (!text || !text.trim()) return {}
    return JSON.parse(text)
  }

  // ----------------------------------------------------------------
  // Helpers: Overlay
  // ----------------------------------------------------------------
  #showOverlay(message) {
    let overlay = document.getElementById('stimulus-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id        = 'stimulus-overlay'
      overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center z-50'
      overlay.innerHTML = `
        <div class="bg-white rounded-xl px-8 py-5 flex items-center gap-4 shadow-xl">
          <span class="material-icons animate-spin text-blue-600">autorenew</span>
          <span id="stimulus-overlay-msg" class="text-sm text-gray-700"></span>
        </div>`
      document.body.appendChild(overlay)
    }
    document.getElementById('stimulus-overlay-msg').textContent = message
    overlay.classList.remove('hidden')
  }

  #hideOverlay() {
    const overlay = document.getElementById('stimulus-overlay')
    if (overlay) overlay.classList.add('hidden')
  }

  // ----------------------------------------------------------------
  // Helpers: Toast
  // ----------------------------------------------------------------
  #showToast(message, type = 'info') {
    const container = document.getElementById('toast-container')
    if (!container) return

    const colors = {
      success: 'bg-green-600',
      error:   'bg-red-600',
      warning: 'bg-yellow-500',
      info:    'bg-blue-600',
    }

    const toast       = document.createElement('div')
    toast.className   = `${colors[type] || colors.info} text-white text-sm px-4 py-3 rounded-lg shadow-lg
      pointer-events-auto flex items-center gap-2 max-w-sm`
    toast.innerHTML   = `<span>${this.#escapeHtml(message)}</span>`

    container.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
  }

  #escapeHtml(str) {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode(str || ''))
    return div.innerHTML
  }
}
