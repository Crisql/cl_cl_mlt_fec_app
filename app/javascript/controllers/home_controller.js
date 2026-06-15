import { Controller } from '@hotwired/stimulus'
import { Storage, SStore } from 'vendor/clavisco/core'
import { showToast } from 'vendor/clavisco/alerts'

/**
 * HomeController — Dashboard principal.
 *
 * Responsabilidades:
 *  - Leer Session desde localStorage, CurrentCompany desde sessionStorage
 *  - Cargar Banner.json y aplicar lógica de visibilidad
 *  - Manejar acciones de banner: cerrar y ver URL
 *
 * Pendiente (cuando se implementen gráficos):
 *  - Llamar APIs de documentos/emails con companyId
 *  - Renderizar charts con Chart.js
 *  - Escuchar evento storage para cambio de empresa
 */
export default class extends Controller {
  static targets = [
    'banner',
    'bannerImage',
    'canvas1', 'canvas2', 'canvas3', 'canvas4', 'canvas5', 'canvas6',
    'chartPlaceholder1', 'chartPlaceholder2', 'chartPlaceholder3',
    'chartPlaceholder4', 'chartPlaceholder5', 'chartPlaceholder6',
    'emailCount',
    'docCount'
  ]

  static values = {
    bannerUrl: { type: String, default: '/banner.json' }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connect() {
    this.#loadCurrentUser()
    this.#loadSelectedCompany()
    this.#loadBanner()
    this.#checkCertExpireAlarm()
  }

  // ---------------------------------------------------------------------------
  // Banner actions
  // ---------------------------------------------------------------------------

  /**
   * Cierra el banner y persiste la preferencia del usuario.
   * Equivalente Angular: CloseBanner()
   */
  closeBanner() {
    this.#hideBanner()
    this.#persistBannerVisibility(true)
  }

  /**
   * Abre la URL del banner en nueva pestaña y persiste la preferencia.
   * Equivalente Angular: ViewBanner()
   */
  viewBanner() {
    if (this.#bannerViewUrl) {
      window.open(this.#bannerViewUrl, '_blank')
    }
    this.#persistBannerVisibility(true)
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** @type {string} */
  #currentUser = ''

  /** @type {{ companyId: string } | null} */
  #selectedCompany = null

  /** @type {string} */
  #bannerViewUrl = ''

  #loadCurrentUser() {
    const session = Storage.get('Session')
    this.#currentUser = session?.UserEmail ?? ''
  }

  #loadSelectedCompany() {
    this.#selectedCompany = SStore.get('CurrentCompany')
  }

  async #loadBanner() {
    try {
      const response = await fetch(this.bannerUrlValue)
      if (!response.ok) return

      const data = await response.json()
      const bannerData = data?.Data?.[0]
      if (!bannerData) return

      if (!bannerData.Visible) return

      // Comprobar si el usuario ya cerró el banner y aún no expiró
      if (this.#isBannerSuppressedForUser()) return

      // Mostrar banner
      this.#bannerViewUrl = bannerData.ViewUrl ?? ''

      if (this.hasBannerImageTarget) {
        this.bannerImageTarget.src = bannerData.ImgBanner ?? ''
      }

      this.#showBanner()

      // Persistir visibilidad inicial
      this.#persistBannerVisibility(bannerData.Visible)
    } catch (error) {
      // Banner no disponible — no bloquear la carga de la página
      console.warn('[HomeController] No se pudo cargar el banner:', error)
    }
  }

  /**
   * Determina si el banner debe suprimirse para el usuario actual.
   * Lógica equivalente al Angular StorageService.GetBannerVisibilityByUser:
   *   - Si existe un entry para el usuario Y ExpiredDate > hoy → suprimir
   *
   * @returns {boolean}
   */
  #isBannerSuppressedForUser() {
    const bannerUsers = Storage.get('BannerUser')
    if (!Array.isArray(bannerUsers)) return false

    const entry = bannerUsers.find((u) => u.currentUser === this.#currentUser)
    if (!entry) return false

    const expiredDate = new Date(entry.ExpiredDate)
    const today = new Date()

    // Si la fecha de expiración es futura → el usuario cerró el banner y aún no caducó
    return expiredDate > today
  }

  /**
   * Persiste la preferencia de visibilidad del banner para el usuario actual.
   * Equivalente Angular: StorageService.SetBannerVisibilityByUser
   *
   * @param {boolean} visibility
   */
  #persistBannerVisibility(visibility) {
    const today = new Date()
    const expirationDate = new Date(today)
    expirationDate.setDate(expirationDate.getDate() + 1)

    let bannerUsers = Storage.get('BannerUser')
    if (!Array.isArray(bannerUsers)) bannerUsers = []

    const existingIndex = bannerUsers.findIndex((u) => u.currentUser === this.#currentUser)
    const entry = {
      currentUser: this.#currentUser,
      BannerVisibility: visibility,
      ExpiredDate: expirationDate.toISOString()
    }

    if (existingIndex >= 0) {
      bannerUsers[existingIndex] = entry
    } else {
      bannerUsers.push(entry)
    }

    Storage.set('BannerUser', bannerUsers)
  }

  /**
   * Consulta la alarma de vencimiento de certificado para la empresa activa
   * y muestra un toast de advertencia si el certificado esta proximo a vencer.
   *
   * Equivalente Angular: GlobalFunctionsService.GetCertExpireDateAlarm(companyId)
   * invocado desde home.component.ts -> Onload().
   *
   * Nota importante sobre el bug del legacy:
   *   el API devuelve `Data` como ARRAY, por lo que `data.Data.ShowAlarm`
   *   siempre era undefined. Aqui se lee `Data[0].ShowAlarm`.
   *
   * Cambio de empresa: company_selector_controller hace window.location.reload(),
   * por lo que connect() se vuelve a ejecutar y la alarma se reevalua con la
   * nueva empresa seleccionada.
   */
  async #checkCertExpireAlarm() {
    const companyId = this.#selectedCompany?.companyId
    if (!companyId) return

    try {
      const json = await this.#apiFetch(
        `/api/Companies/GetCertExpireDateAlarm?companyId=${companyId}`
      )

      const alarm = Array.isArray(json?.Data) ? json.Data[0] : json?.Data

      if (alarm) {
        if (alarm.ShowAlarm) {
          showToast(alarm.SmsAlert, 'warning')
        }
      } else if (json?.Message) {
        showToast(json.Message, 'warning')
      }
    } catch (error) {
      showToast(
        error.message || 'Error al obtener la fecha de expiracion del certificado',
        'error'
      )
    }
  }

  /**
   * Fetch contra el App server (ApiAppUrl). Reenvia token de sesion y
   * Cl-Company-Id, y decodifica el header `cl-message` para errores.
   */
  async #apiFetch(url, options = {}) {
    const token     = (Storage.get('Session') || {}).access_token
    const company   = SStore.get('CurrentCompany')
    const companyId = company?.companyId ?? this.#selectedCompany?.companyId

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

  #showBanner() {
    if (this.hasBannerTarget) {
      this.bannerTarget.classList.remove('hidden')
    }
  }

  #hideBanner() {
    if (this.hasBannerTarget) {
      this.bannerTarget.classList.add('hidden')
    }
  }
}
