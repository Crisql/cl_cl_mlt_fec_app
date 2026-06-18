import { Controller } from '@hotwired/stimulus'
import { TabulatorFull } from 'tabulator-tables'
import { Storage, SStore, getApiHeaders } from 'vendor/clavisco/core'
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale'

/**
 * CompanySelectorController — Panel lateral de selección de empresa.
 *
 * Responsabilidades:
 *  - Mostrar nombre de empresa seleccionada en el toolbar
 *  - Abrir panel lateral con lista filtrable de empresas
 *  - Al cambiar empresa: guardar en localStorage, recargar permisos, reload
 *  - Abrir automáticamente si no hay empresa seleccionada al cargar
 */
export default class extends Controller {
  static targets = [
    'panel',
    'panelBackdrop',
    'pageLoader',
    'toolbarLabel',
    'searchInput',
    'table',
    'cancelBtn',
    'confirmBtn',
    'contextMenu'
  ]

  /** @type {Array} Lista completa de empresas cargadas */
  #companies = []

  /** @type {object|null} Empresa seleccionada en el UI (pendiente de confirmar) */
  #pendingSelection = null

  /** @type {import('tabulator-tables').Tabulator|null} Instancia de la tabla */
  #table = null

  /** @type {Function|null} Handler de click global para cerrar el context menu */
  #contextMenuDismissHandler = null

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connect() {
    this.#updateToolbarLabel()

    // Abrir automáticamente si no hay empresa seleccionada
    const company = SStore.get('CurrentCompany')
    if (!company?.companyId) {
      const favoriteCompany = Storage.get("FavoriteCompany");
      if(favoriteCompany)
      {
        this.#applyCompanyChange({
          EmsrNombreComercial: favoriteCompany.companyName, 
          Id: favoriteCompany.companyId, 
          CodigoActividad: favoriteCompany.codigoActividad, 
          GroupId: favoriteCompany.groupId, 
          UseFactProv: favoriteCompany.UseFactProv,
          SendReceptAndApInv: favoriteCompany.SendReceptAndApInv
        });
      }
      else
      {
        this.open()
      }
    }
  }

  disconnect() {
    this.#table?.destroy()
    this.#table = null
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  open() {
    this.#pendingSelection = null
    this.#resetInput()
    this.#showCancelIfApplicable()
    this.#setConfirmDisabled(true)
    this.#showModal()
    this.#loadCompanies()
  }

  close() {
    const company = SStore.get('CurrentCompany')
    // Solo permitir cerrar si ya hay una empresa seleccionada
    if (!company?.companyId) return
    this.#hideModal()
  }

  overlayClick() {
    this.close()
  }

  filter() {
    if (!this.#table) return
    const query = this.searchInputTarget.value.toLowerCase().trim()
    if (!query) {
      this.#table.clearFilter()
      return
    }
    this.#table.setFilter(row =>
      `${row.EmsrIdeNumero} - ${row.EmsrNombreComercial}`.toLowerCase().includes(query)
    )
  }

  confirm() {
    if (!this.#pendingSelection) return

    const current = SStore.get('CurrentCompany')

    // Misma empresa → solo cerrar
    if (current?.companyId === this.#pendingSelection.Id) {
      this.#hideModal()
      return
    }

    this.#applyCompanyChange(this.#pendingSelection)
  }

  /**
   * Click derecho en el botón de compañía.
   * Solo muestra el menú si el usuario tiene F_ModifyCompany.
   */
  onContextMenu(event) {
    event.preventDefault()

    const permissions = SStore.get('Permissions') ?? []
    if (!permissions.includes('F_ModifyCompany')) return
    if (!this.hasContextMenuTarget) return

    this.contextMenuTarget.classList.remove('hidden')

    // Cerrar al hacer click en cualquier otro lugar
    this.#contextMenuDismissHandler = () => this.#closeContextMenu()
    document.addEventListener('click', this.#contextMenuDismissHandler, { once: true })
  }

  navigateToCompanyEdit() {
    this.#closeContextMenu()
    const company = SStore.get('CurrentCompany')
    if (!company?.companyId) return
    Turbo.visit(`/configurations/companies/${company.companyId}/edit`)
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  #closeContextMenu() {
    if (!this.hasContextMenuTarget) return
    this.contextMenuTarget.classList.add('hidden')
    if (this.#contextMenuDismissHandler) {
      document.removeEventListener('click', this.#contextMenuDismissHandler)
      this.#contextMenuDismissHandler = null
    }
  }

  #updateToolbarLabel() {
    if (!this.hasToolbarLabelTarget) return
    const company = SStore.get('CurrentCompany')
    this.toolbarLabelTarget.textContent = company?.companyName ?? 'No seleccionada'

    // Tooltip con ID
    const btn = this.toolbarLabelTarget.closest('button')
    if (btn && company?.companyId) {
      btn.title = `Identificador: ${company.companyId}`
    }
  }

  #showCancelIfApplicable() {
    if (!this.hasCancelBtnTarget) return
    const company = SStore.get('CurrentCompany')
    if (company?.companyId) {
      this.cancelBtnTarget.classList.remove('hidden')
    } else {
      this.cancelBtnTarget.classList.add('hidden')
    }
  }

  #showModal() {
    if (!this.hasPanelTarget) return
    this.panelBackdropTarget.classList.remove('hidden')
    this.panelTarget.classList.remove('translate-x-full')
    document.body.style.overflow = 'hidden'
  }

  #hideModal() {
    if (!this.hasPanelTarget) return
    this.panelTarget.classList.add('translate-x-full')
    this.panelBackdropTarget.classList.add('hidden')
    document.body.style.overflow = ''
  }

  #resetInput() {
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ''
    this.#table?.clearFilter()
    this.#clearSelection()
  }

  #setConfirmDisabled(disabled) {
    if (!this.hasConfirmBtnTarget) return
    this.confirmBtnTarget.disabled = disabled
  }

  #initTable() {
    if (this.#table || !this.hasTableTarget) return

    this.#table = new TabulatorFull(this.tableTarget, {
      height:            '100%',
      layout:            'fitColumns',
      placeholder:       'Sin resultados',
      locale:            TABULATOR_LOCALE,
      langs:             TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: {
        headerSort: true,
        // cellClick es el mecanismo de clic probado en el proyecto (Tabulator no
        // dispara rowClick de forma fiable en este build); cubre toda la fila.
        cellClick:    (_e, cell) => this.#selectRow(cell.getRow()),
        cellDblClick: (_e, cell) => { this.#selectRow(cell.getRow()); this.confirm() },
      },
      columns: [
        { title: 'Identificación',   field: 'EmsrIdeNumero',       width: 130 },
        { title: 'Nombre Comercial', field: 'EmsrNombreComercial', widthGrow: 1 },
      ],
    })
  }

  /** Marca una fila como seleccionada (resaltado + estado pendiente). */
  #selectRow(row) {
    this.#table?.getRows().forEach(r => { r.getElement().style.backgroundColor = '' })
    row.getElement().style.backgroundColor = '#dbeafe' // blue-100
    this.#pendingSelection = row.getData()
    this.#setConfirmDisabled(false)
  }

  /** Limpia la selección y su resaltado. */
  #clearSelection() {
    this.#pendingSelection = null
    this.#table?.getRows().forEach(r => { r.getElement().style.backgroundColor = '' })
    this.#setConfirmDisabled(true)
  }

  async #loadCompanies() {
    this.#initTable()
    this.#table.alert(TABULATOR_LOADING_HTML)

    try {
      const response = await fetch(
        '/api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active',
        { headers: getApiHeaders() }
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      this.#companies = data?.Data ?? []
      this.#table.clearAlert()
      await this.#table.setData(this.#companies)
      // El panel entra con translate-x; forzamos redibujado para que calcule la altura
      requestAnimationFrame(() => this.#table?.redraw(true))
    } catch (error) {
      console.error('[CompanySelector] Error cargando empresas:', error)
      this.#table.clearAlert()
      this.#table.alert('Error al cargar compañías', 'error')
    }
  }

  async #applyCompanyChange(company) {
    this.#setConfirmDisabled(true)
    this.#hideModal()
    if (this.hasPageLoaderTarget) this.pageLoaderTarget.classList.remove('hidden')

    // 1. Guardar empresa en localStorage
    SStore.set('CurrentCompany', {
      companyName:        company.EmsrNombreComercial,
      companyId:          company.Id,
      codigoActividad:    company.CodigoActividad,
      groupId:            company.GroupId,
      UseFactProv:        company.UseFactProv,
      SendReceptAndApInv: company.SendReceptAndApInv
    })

    // 2. Limpiar permisos anteriores
    sessionStorage.removeItem('Permissions')

    // 3. Cargar nuevos permisos y token del servidor FE Sync en paralelo
    await Promise.all([
      this.#reloadPermissions(company.Id),
      this.#reloadFEToken(company.Id),
    ])

    // 4. Recargar página
    window.location.reload()
  }

  /**
   * Obtiene las credenciales FE de la empresa y hace login en el servidor Sync
   * para obtener el token que se usa en requests ApiFEUrl.
   * Replica el flujo de UsabilityInformationService.GetFECredentialsObservable() del Angular legacy.
   * El token se guarda en sessionStorage.currentFEUser.
   */
  async #reloadFEToken(companyId) {
    try {
      const session   = Storage.get('Session') || {}
      const token     = session.access_token
      if (!token) return

      // 1. Obtener credenciales FE para esta empresa (App server)
      const credsResp = await fetch(
        `/api/Credentials/GetFeCredentials?companyId=${companyId}`,
        {
          headers: {
            'Content-Type':             'application/json',
            'API':                      'ApiAppUrl',
            'X-Skip-Error-Interceptor': 'true',
            'Authorization':            `Bearer ${token}`,
          },
        }
      )
      if (!credsResp.ok) return
      const credsData = await credsResp.json()
      const creds = credsData?.Data?.[0]
      if (!creds) return

      // 2. Limpiar token FE anterior
      sessionStorage.removeItem('currentFEUser')

      // 3. Login en el servidor FE Sync (form-encoded, igual que Angular getFEToken)
      //    El proxy stripea /api/token → /token cuando API: ApiFEUrl
      const body = new URLSearchParams({
        grant_type: 'password',
        username:   creds.UserId,
        password:   creds.Password,
      })

      const feTokenResp = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type':             'application/x-www-form-urlencoded',
          'API':                      'ApiFEUrl',
          'X-Skip-Error-Interceptor': 'true',
        },
        body: body.toString(),
      })
      if (!feTokenResp.ok) return
      const feToken = await feTokenResp.json()

      // 4. Guardar token FE en sessionStorage (mismo key que Angular legacy)
      if (feToken?.access_token) {
        sessionStorage.setItem('currentFEUser', JSON.stringify(feToken))
      }
    } catch {
      // Token FE no crítico para cargar la empresa; se reintentará en el siguiente cambio
    }
  }

  async #reloadPermissions(companyId) {
    try {
      const response = await fetch(
        `/api/Permission/GetPermsByUser?companyId=${companyId}`,
        { headers: getApiHeaders() }
      )
      if (!response.ok) return
      const data = await response.json()
      const perms = (data?.Data ?? []).map(p => p.Name)
      SStore.set('Permissions', perms)
    } catch {
      // Permisos se cargarán en el siguiente connect() del menu_controller
    }
  }
}
