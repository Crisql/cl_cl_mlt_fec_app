import { Controller } from '@hotwired/stimulus'
import { Storage, SStore, getApiHeaders } from 'vendor/clavisco/core'

/**
 * CompanySelectorController — Modal de selección de empresa.
 *
 * Responsabilidades:
 *  - Mostrar nombre de empresa seleccionada en el toolbar
 *  - Abrir modal con lista filtrable de empresas
 *  - Al cambiar empresa: guardar en localStorage, recargar permisos, reload
 *  - Abrir automáticamente si no hay empresa seleccionada al cargar
 */
export default class extends Controller {
  static targets = [
    'modal',
    'toolbarLabel',
    'searchInput',
    'list',
    'loading',
    'cancelBtn',
    'confirmBtn'
  ]

  /** @type {Array} Lista completa de empresas cargadas */
  #companies = []

  /** @type {object|null} Empresa seleccionada en el UI (pendiente de confirmar) */
  #pendingSelection = null

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
    const query = this.searchInputTarget.value.toLowerCase()
    this.#renderList(
      this.#companies.filter(c =>
        `${c.EmsrIdeNumero} - ${c.EmsrNombreComercial}`.toLowerCase().includes(query)
      )
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

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

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
    if (!this.hasModalTarget) return
    this.modalTarget.classList.remove('hidden')
  }

  #hideModal() {
    if (!this.hasModalTarget) return
    this.modalTarget.classList.add('hidden')
  }

  #resetInput() {
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ''
    if (this.hasListTarget) this.listTarget.innerHTML = ''
  }

  #setConfirmDisabled(disabled) {
    if (!this.hasConfirmBtnTarget) return
    this.confirmBtnTarget.disabled = disabled
  }

  async #loadCompanies() {
    if (this.hasLoadingTarget) this.loadingTarget.classList.remove('hidden')
    if (this.hasListTarget)    this.listTarget.innerHTML = ''

    try {
      const response = await fetch(
        '/api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active',
        { headers: getApiHeaders() }
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      this.#companies = data?.Data ?? []
      this.#renderList(this.#companies)
    } catch (error) {
      console.error('[CompanySelector] Error cargando empresas:', error)
      if (this.hasListTarget) {
        this.listTarget.innerHTML = '<li class="px-4 py-3 text-sm text-red-500">Error al cargar compañías</li>'
      }
    } finally {
      if (this.hasLoadingTarget) this.loadingTarget.classList.add('hidden')
    }
  }

  #renderList(companies) {
    if (!this.hasListTarget) return
    this.listTarget.innerHTML = ''

    if (companies.length === 0) {
      this.listTarget.innerHTML = '<li class="px-4 py-3 text-sm text-gray-400 text-center">Sin resultados</li>'
      return
    }

    companies.forEach(company => {
      const li = document.createElement('li')
      li.dataset.testid = 'company-option'
      li.className = [
        'px-4 py-2.5 text-sm text-gray-700 cursor-pointer',
        'hover:bg-blue-50 hover:text-blue-700 transition-colors'
      ].join(' ')
      li.textContent = `${company.EmsrIdeNumero} - ${company.EmsrNombreComercial}`

      li.addEventListener('click', () => {
        // Resaltar selección
        this.listTarget.querySelectorAll('li').forEach(el =>
          el.classList.remove('bg-blue-100', 'text-blue-800', 'font-medium')
        )
        li.classList.add('bg-blue-100', 'text-blue-800', 'font-medium')

        this.#pendingSelection = company
        this.#setConfirmDisabled(false)
      })

      this.listTarget.appendChild(li)
    })
  }

  async #applyCompanyChange(company) {
    this.#setConfirmDisabled(true)

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
