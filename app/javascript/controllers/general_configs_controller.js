import { Controller } from '@hotwired/stimulus'
import { Storage, SStore } from 'vendor/clavisco/core'
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts'
import { showLoading, hideLoading } from 'vendor/clavisco/overlay'

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
    'formatLoader',
    'cedulaLoader',
    'crystalUserInput',
    'crystalPasswordInput',
    'crystalLoader',
    'crystalPasswordToggle',
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
    // Cada sección tiene su propia consulta → loader independiente por sección
    // (sin overlay global de página). Ver CLAUDE.md §15.
    await Promise.all([
      this.#loadGeneralConfigs(),
      this.#loadSettings(),
    ])
  }

  async #loadGeneralConfigs() {
    this.#showSectionLoader(this.formatLoaderTarget)
    try {
      const data = await this.#apiFetch('/api/GeneralConfigs/GetGeneralConfigs')

      if (data.Data && data.Data.length > 0) {
        const config = data.Data[0]
        this.#generalConfigId = config.Id

        const fullPath = config.DefaultPrintFormatPath || ''
        const fileName = fullPath ? fullPath.split('\\').at(-1) : ''
        this.printFormatInputTarget.value = fileName

        showToast('Configuraciones generales obtenidos con éxito!!!', 'success')
      } else {
        showToast(data.Message || 'No se encontraron configuraciones', 'warning')
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar configuraciones generales', 'error')
    } finally {
      this.#hideSectionLoader(this.formatLoaderTarget)
    }
  }

  async #loadSettings() {
    this.#showSectionLoader(this.cedulaLoaderTarget)
    this.#showSectionLoader(this.crystalLoaderTarget)
    try {
      const data = await this.#apiFetch('/api/settings')

      if (data.Data) {
        const cedula   = data.Data.find(s => s.Code === 'CedulaProveedorSistemas')
        const crystalU = data.Data.find(s => s.Code === 'CrystalUser')
        const crystalP = data.Data.find(s => s.Code === 'CrystalPassword')
        if (cedula)   this.cedulaInputTarget.value        = cedula.Json
        if (crystalU) this.crystalUserInputTarget.value   = crystalU.Json
        if (crystalP) this.crystalPasswordInputTarget.value = crystalP.Json
      } else {
        showToast(data.Message || 'No se pudieron cargar los ajustes', 'warning')
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar ajustes', 'error')
    } finally {
      this.#hideSectionLoader(this.cedulaLoaderTarget)
      this.#hideSectionLoader(this.crystalLoaderTarget)
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
      showToast(
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

      showToast('Configuración general editada con éxito!!!', 'success')
      this.#selectedFile = null
      this.fileInputTarget.value = ''
      this.btnUpdateFormatTarget.disabled = true

      // Recargar para mostrar el nombre actualizado
      await this.#loadGeneralConfigs()
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar formato de impresión', message: err.message || 'Error desconocido' })
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
      showToast(err.message || 'Error al descargar el formato de impresión', 'error')
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

      showToast('Cédula proveedor sistemas actualizada con éxito!!!', 'success')
      await this.#loadSettings()
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar cédula', message: err.message || 'Error desconocido' })
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // Actualizar Credenciales Crystal
  // ----------------------------------------------------------------
  async updateCrystal() {
    const user     = this.crystalUserInputTarget.value
    const password = this.crystalPasswordInputTarget.value

    this.#showOverlay('Actualizando credenciales Crystal, espere por favor...')

    try {
      const session      = Storage.get('Session') || {}
      const feSyncToken  = session.access_token
      const sharedHeaders = { 'X-Authorization-FESync': feSyncToken || '' }

      await this.#apiFetch('/api/settings', {
        method: 'PATCH',
        headers: sharedHeaders,
        body: JSON.stringify({ Code: 'CrystalUser', Json: user, IsActive: true }),
      })

      await this.#apiFetch('/api/settings', {
        method: 'PATCH',
        headers: sharedHeaders,
        body: JSON.stringify({ Code: 'CrystalPassword', Json: password, IsActive: true }),
      })

      showToast('Credenciales Crystal actualizadas con éxito!!!', 'success')
      await this.#loadSettings()
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar credenciales Crystal', message: err.message || 'Error desconocido' })
    } finally {
      this.#hideOverlay()
    }
  }

  toggleCrystalPassword() {
    const input  = this.crystalPasswordInputTarget
    const icon   = this.crystalPasswordToggleTarget.querySelector('.material-icons')
    const isPass = input.type === 'password'
    input.type       = isPass ? 'text' : 'password'
    icon.textContent = isPass ? 'visibility' : 'visibility_off'
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
  // Helpers: Overlay global (operaciones de escritura — bloqueante)
  // ----------------------------------------------------------------
  #showOverlay(message) { showLoading(message) }
  #hideOverlay()        { hideLoading() }

  // ----------------------------------------------------------------
  // Helpers: Loader por sección (carga de lectura — sin texto)
  // ----------------------------------------------------------------
  #showSectionLoader(target) { target?.classList.remove('hidden') }
  #hideSectionLoader(target) { target?.classList.add('hidden') }

}
