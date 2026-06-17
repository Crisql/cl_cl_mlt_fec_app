import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller'
import { Storage, SStore } from 'vendor/clavisco/core'
import { showToast, showAlert, ALERT_TYPES, confirm } from 'vendor/clavisco/alerts'
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale'

/**
 * GroupController — Gestión de grupos / cuentas.
 *
 * Replica la funcionalidad del componente Angular GroupsComponent:
 *   - Carga inicial: GET api/Group/GetGroupsByUser?companyId={id}
 *   - Tabla "Usuarios de la Cuenta": GET api/User/GetUsersByGroup?companyId={id}
 *   - Tabla "Compañías de la Cuenta": GET api/Companies/GetCompaniesByGroup?groupId={id}
 *   - Actualizar grupo: PATCH api/Group (FormData: Group JSON + archivo .rpt opcional)
 *   - Restablecer formato: PATCH api/Group/ResetPrintFormat?groupId={id} (con confirmación)
 *   - Descargar formato: GET api/Group/{groupId}/print-format (Blob)
 *   - Crear grupo: POST api/Group (panel lateral)
 *   - Control de visibilidad por permisos
 *
 * Extiende TabulatorController para la tabla activa (usuarios por defecto).
 * La segunda tabla (compañías) se maneja con una instancia Tabulator separada.
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    // Formulario
    'groupName',
    'groupDescription',
    'printFormatInput',
    'fileInput',
    // Botones principales
    'updateBtn',
    'resetFormatBtn',
    'createBtn',
    'downloadFormatBtn',
    // Tabs
    'tabUsers',
    'tabCompanies',
    'panelUsers',
    'panelCompanies',
    // Tabla compañías (segunda instancia, no usa TabulatorController base)
    'companiesTable',
    // Panel lateral crear
    'panelBackdrop',
    'createPanel',
    'newGroupName',
    'newGroupNameError',
    'newGroupDescription',
    'createSubmitBtn',
    // Loader de sección
    'sectionLoader',
  ]

  static values = { ...TabulatorController.values }

  // ── Estado interno ─────────────────────────────────────────────────────────

  #groupId      = null
  #companyId    = null
  #selectedFile = null
  #permissions  = []
  /** Instancia Tabulator para la tabla de compañías */
  #companiesTableInstance = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company      = SStore.get('CurrentCompany') || {}
    this.#companyId    = company.companyId ? parseInt(company.companyId) : null
    this.#permissions  = SStore.get('Permissions') || []

    // TabulatorController usa el target 'table' que en este caso es usersTable.
    // Se llama super.connect() sin datos — la tabla se pobla tras la carga.
    super.connect()

    this.#applyPermissions()
    this.#loadInitialData()

    // Habilitar/deshabilitar botón Crear del panel según input
    this.newGroupNameTarget.addEventListener('input', () => this.#validateCreateForm())
  }

  disconnect() {
    this.#companiesTableInstance?.destroy()
    super.disconnect()
  }

  // ── Configuración Tabulator (tabla usuarios — base) ────────────────────────

  getTableConfig() {
    return {
      height:           '100%',
      layout:           'fitColumns',
      placeholder:      'Sin usuarios',
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      paginationCounter: 'rows',
      locale:            TABULATOR_LOCALE,
      langs:             TABULATOR_LANGS,
      columns: [
        { title: 'Usuario', field: 'UserName', sorter: 'string', widthGrow: 1 },
        { title: 'Email',   field: 'Email',    sorter: 'string', widthGrow: 1 },
      ],
    }
  }

  // ── Configuración tabla compañías ─────────────────────────────────────────

  #getCompaniesTableConfig() {
    return {
      height:            '100%',
      layout:            'fitColumns',
      placeholder:       'Sin compañías',
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      paginationCounter: 'rows',
      locale:            TABULATOR_LOCALE,
      langs:             TABULATOR_LANGS,
      columns: [
        { title: 'Identificación', field: 'Identification', sorter: 'string',  widthGrow: 1 },
        { title: 'Nombre Legal',   field: 'LegalName',      sorter: 'string',  widthGrow: 1 },
        { title: 'Nombre Comercial', field: 'ComercialName', sorter: 'string', widthGrow: 1 },
        {
          title:  'Activa',
          field:  'Active',
          sorter: 'string',
          width:  100,
          formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
          headerSort: false,
        },
      ],
    }
  }

  // ── Permisos ──────────────────────────────────────────────────────────────

  #hasPerm(name) { return this.#permissions.includes(name) }

  #applyPermissions() {
    const canUpdate   = this.#hasPerm('Configurations_Groups_Update') ||
                        this.#hasPerm('Configurations_Groups_UpdateAllInApplication')
    const canDownload = this.#hasPerm('Configurations_Groups_DownloadFEPrintFormatInAllGroups') ||
                        this.#hasPerm('Configurations_Groups_DownloadFEPrintFormat')
    const canCreate   = this.#hasPerm('Configurations_Groups_Create')

    if (canUpdate)   {
      this.updateBtnTarget.classList.remove('hidden')
      this.resetFormatBtnTarget.classList.remove('hidden')
    }
    if (canDownload) this.downloadFormatBtnTarget.classList.remove('hidden')
    if (canCreate)   this.createBtnTarget.classList.remove('hidden')
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────

  #showLoader() { if (this.hasSectionLoaderTarget) this.sectionLoaderTarget.classList.remove('hidden') }
  #hideLoader() { if (this.hasSectionLoaderTarget) this.sectionLoaderTarget.classList.add('hidden') }

  async #loadInitialData() {
    this.#showLoader()
    try {
      const data = await this.#apiFetch(`/api/Group/GetGroupsByUser?companyId=${this.#companyId}`)
      if (!data.Data?.length) {
        showToast(data.Message || 'No se encontró información del grupo.', 'warning')
        return
      }

      const group = data.Data[0]
      this.#groupId = group.Id

      this.groupNameTarget.value        = group.GroupName        || ''
      this.groupDescriptionTarget.value = group.GroupDescription || ''

      const fullPath = group.DefaultPrintFormatPath || ''
      this.printFormatInputTarget.value = fullPath ? fullPath.split('\\').pop() : ''

      await Promise.all([
        this.#loadUsers(),
        this.#loadCompanies(),
      ])
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Se produjo un error al obtener la información del grupo', message: err.message })
    } finally {
      this.#hideLoader()
    }
  }

  async #loadUsers() {
    try {
      const data = await this.#apiFetch(`/api/User/GetUsersByGroup?companyId=${this.#companyId}`)
      const users = data.Data || []
      if (users.length === 0) {
        showToast('No se encontraron usuarios para este grupo.', 'warning')
      }
      this.table?.setData(users)
    } catch (err) {
      showToast(err.message || 'Error al cargar usuarios.', 'error')
    }
  }

  async #loadCompanies() {
    try {
      const data = await this.#apiFetch(`/api/Companies/GetCompaniesByGroup?groupId=${this.#groupId}`)
      const companies = data.Data || []
      this.#initCompaniesTable(companies)
    } catch (err) {
      showToast(err.message || 'Error al cargar compañías.', 'error')
    }
  }

  // ── Tabla compañías ───────────────────────────────────────────────────────

  #initCompaniesTable(data) {
    if (this.#companiesTableInstance) {
      this.#companiesTableInstance.setData(data)
      return
    }

    import('tabulator-tables').then(({ TabulatorFull }) => {
      this.#companiesTableInstance = new TabulatorFull(
        this.companiesTableTarget,
        { ...this.#getCompaniesTableConfig(), data }
      )
    })
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  showTabUsers() {
    this.panelUsersTarget.classList.remove('hidden')
    this.panelCompaniesTarget.classList.add('hidden')

    this.tabUsersTarget.classList.add('text-blue-600', 'border-blue-600')
    this.tabUsersTarget.classList.remove('text-gray-500', 'border-transparent')
    this.tabCompaniesTarget.classList.remove('text-blue-600', 'border-blue-600')
    this.tabCompaniesTarget.classList.add('text-gray-500', 'border-transparent')
  }

  showTabCompanies() {
    this.panelCompaniesTarget.classList.remove('hidden')
    this.panelUsersTarget.classList.add('hidden')

    this.tabCompaniesTarget.classList.add('text-blue-600', 'border-blue-600')
    this.tabCompaniesTarget.classList.remove('text-gray-500', 'border-transparent')
    this.tabUsersTarget.classList.remove('text-blue-600', 'border-blue-600')
    this.tabUsersTarget.classList.add('text-gray-500', 'border-transparent')

    // Redibujar si la tabla ya fue inicializada (puede haberse renderizado en un contenedor oculto)
    requestAnimationFrame(() => this.#companiesTableInstance?.redraw(true))
  }

  // ── Archivo .rpt ─────────────────────────────────────────────────────────

  triggerFileInput() {
    this.fileInputTarget.click()
  }

  onFileSelected(event) {
    const file = event.target.files[0]
    if (!file) {
      this.printFormatInputTarget.value = ''
      this.#selectedFile = null
      return
    }

    if (!file.name.endsWith('.rpt')) {
      this.#selectedFile = null
      this.printFormatInputTarget.value = ''
      this.fileInputTarget.value = ''
      showToast('Por favor seleccione un formato de impresión válido para continuar, gracias', 'error')
      return
    }

    this.#selectedFile = file
    this.printFormatInputTarget.value = file.name
  }

  // ── Actualizar grupo ──────────────────────────────────────────────────────

  async updateGroup() {
    const description = this.groupDescriptionTarget.value.trim()
    if (!description) {
      showToast('La descripción es requerida.', 'warning')
      return
    }

    const group = {
      Id:                     this.#groupId,
      GroupName:              this.groupNameTarget.value,
      GroupDescription:       description,
      DefaultPrintFormatPath: this.#selectedFile?.name || '',
    }

    const fd = new FormData()
    fd.append('Group', JSON.stringify(group))
    if (this.#selectedFile) fd.append('file', this.#selectedFile)

    try {
      await this.#apiFetch('/api/Group', {
        method:  'PATCH',
        headers: { 'Request-With-Files': 'true' },
        body:    fd,
      })
      showToast('Grupo actualizado exitosamente', 'success')
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar el grupo', message: err.message })
    }
  }

  // ── Restablecer formato ───────────────────────────────────────────────────

  async resetPrintFormat() {
    const confirmed = await confirm('Esta acción restablecerá el formato de impresión al predeterminado.', 'Restablecer formato')
    if (!confirmed) return
    try {
      await this.#apiFetch(`/api/Group/ResetPrintFormat?groupId=${this.#groupId}`, { method: 'PATCH' })
      showToast('Formato de impresión restablecido con éxito', 'success')
      await this.#loadInitialData()
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al restablecer el formato de impresión', message: err.message })
    }
  }

  // ── Descargar formato ─────────────────────────────────────────────────────

  async downloadPrintFormat() {
    try {
      const session = Storage.get('Session') || {}
      const token   = session.access_token

      const response = await fetch(`/api/Group/${this.#groupId}/print-format`, {
        headers: {
          'API':                      'ApiAppUrl',
          'X-Skip-Error-Interceptor': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const fileName = this.printFormatInputTarget.value || 'formato-impresion.rpt'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err.message || 'Error al descargar el formato de impresión.', 'error')
    }
  }

  // ── Panel crear grupo ─────────────────────────────────────────────────────

  openCreatePanel() {
    this.newGroupNameTarget.value        = ''
    this.newGroupDescriptionTarget.value = ''
    this.newGroupNameErrorTarget.classList.add('hidden')
    this.createSubmitBtnTarget.disabled  = true

    this.panelBackdropTarget.classList.remove('hidden')
    this.createPanelTarget.classList.remove('translate-x-full')
    document.body.style.overflow = 'hidden'
  }

  closeCreatePanel() {
    this.createPanelTarget.classList.add('translate-x-full')
    this.panelBackdropTarget.classList.add('hidden')
    document.body.style.overflow = ''
  }

  #validateCreateForm() {
    const valid = this.newGroupNameTarget.value.trim().length > 0
    this.createSubmitBtnTarget.disabled = !valid
    this.newGroupNameErrorTarget.classList.toggle('hidden', valid)
  }

  async createGroup() {
    const name = this.newGroupNameTarget.value.trim()
    if (!name) {
      this.newGroupNameErrorTarget.classList.remove('hidden')
      return
    }

    const payload = {
      Id:                     0,
      GroupName:              name,
      GroupDescription:       this.newGroupDescriptionTarget.value.trim(),
      DefaultPrintFormatPath: '',
    }

    try {
      await this.#apiFetch('/api/Group', {
        method: 'POST',
        body:   JSON.stringify(payload),
      })
      showToast('Grupo registrado exitosamente', 'success')
      this.closeCreatePanel()
      await this.#loadInitialData()
    } catch (err) {
      showToast(err.message || 'Error al crear el grupo.', 'error')
    }
  }

  // ── Badge de estado (CLAUDE.md §1) ────────────────────────────────────────

  #statusBadge(status) {
    const map = {
      active:   { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'   },
      inactive: { bg: '#fdecea', color: '#c0392b', label: 'Inactivo' },
    }
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status }
    return `<span style="background-color:${bg}; color:${color};"
                 class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${label}
    </span>`
  }

  // ── apiFetch (CLAUDE.md §6) ───────────────────────────────────────────────

  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {}
    const token   = session.access_token

    // Para FormData no enviar Content-Type (el browser lo agrega con boundary)
    const isFormData = options.body instanceof FormData
    const baseHeaders = {
      'API':                      'ApiAppUrl',
      'X-Skip-Error-Interceptor': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    if (!isFormData) baseHeaders['Content-Type'] = 'application/json'

    const response = await fetch(url, {
      ...options,
      headers: { ...baseHeaders, ...(options.headers || {}) },
    })

    const clMessage = response.headers.get('cl-message')
    const decodedMessage = clMessage ? (() => {
      try { return decodeURIComponent(clMessage) } catch { return clMessage }
    })() : null

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(decodedMessage || text || `HTTP ${response.status}`)
    }

    // 204 No Content (y cualquier respuesta sin body) — no intentar parsear JSON.
    const hasBody = response.status !== 204 &&
                    response.headers.get('content-length') !== '0' &&
                    response.headers.get('content-type')?.includes('application/json')
    if (!hasBody) return { Message: decodedMessage || null }

    const json = await response.json()
    if (decodedMessage && !json.Message) json.Message = decodedMessage
    return json
  }
}
