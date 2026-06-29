import { Controller } from '@hotwired/stimulus'
import { SStore, getApiHeaders, isSessionValid } from 'vendor/clavisco/core'
import MENU_NODES from 'data/menu'

// Mapa plano ruta → permiso(s) requerido(s), construido una sola vez desde menu.js.
const ROUTE_PERMISSION_MAP = (() => {
  const map = {}
  for (const node of MENU_NODES) {
    if (node.route && node.requiredPermission) map[node.route] = node.requiredPermission
    for (const child of node.nodes ?? []) {
      if (child.route && child.requiredPermission) map[child.route] = child.requiredPermission
    }
  }
  return map
})()

export default class extends Controller {
  static values = {
    loginPath:   { type: String, default: '/login' },
    sessionName: { type: String, default: 'Session' }
  }

  connect() {
    // Si la sesión no es válida, redirigir a login y NO continuar: chequear
    // permisos revelaría contenido o dispararía fetches innecesarios mientras
    // el navegador todavía no completó la navegación a /login.
    if (!this.#checkAuth()) return
    this.#checkRoutePermission()
  }

  // Logout explícito (llamar desde el menú)
  logout() {
    this.#clearSession()
    this.#redirectToLogin()
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Verifica la sesión almacenada. Si es válida retorna true; si no, limpia la
   * sesión (cuando expiró), redirige a login y retorna false.
   * @returns {boolean}
   */
  #checkAuth() {
    const session = this.#getSession()

    if (!session || !session.access_token) {
      this.#redirectToLogin()
      return false
    }

    // isSessionValid centraliza la regla de expiración (expires_at = JWT exp en ms).
    if (!isSessionValid()) {
      this.#clearSession()
      this.#redirectToLogin()
      return false
    }

    return true
  }

  async #checkRoutePermission() {
    const required = ROUTE_PERMISSION_MAP[window.location.pathname]

    if (!required) {
      this.#revealContent()
      return
    }

    let permissions = SStore.get('Permissions')

    // Si no hay caché (primera carga o nueva pestaña), cargarlos del API.
    // Mismo patrón que menu_controller — el segundo en correr encontrará el caché.
    if (!permissions) {
      const company = SStore.get('CurrentCompany')
      if (!company?.companyId) {
        this.#revealContent()
        return
      }
      permissions = await this.#fetchPermissions(company.companyId)
    }

    const permSet = new Set(Array.isArray(permissions) ? permissions : [])
    const hasPerm = Array.isArray(required)
      ? required.some(p => permSet.has(p))
      : permSet.has(required)

    if (hasPerm) {
      this.#revealContent()
    } else {
      if (window.Turbo) {
        window.Turbo.visit('/not-found')
      } else {
        window.location.href = '/not-found'
      }
    }
  }

  #revealContent() {
    document.querySelectorAll('[data-auth-content]').forEach(el => el.classList.remove('invisible'))
    const meta = document.querySelector('meta[name="x-page-title"]')
    document.title = meta ? meta.content : 'Factura Electrónica'
  }

  async #fetchPermissions(companyId) {
    try {
      const response = await fetch(
        `/api/Permission/GetPermsByUser?companyId=${companyId}`,
        { headers: getApiHeaders() }
      )
      if (!response.ok) return []
      const data = await response.json()
      const perms = (data?.Data ?? []).map(p => p.Name)
      SStore.set('Permissions', perms)
      return perms
    } catch {
      return []
    }
  }

  #getSession() {
    try {
      const raw = localStorage.getItem(this.sessionNameValue)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  #clearSession() {
    // localStorage — datos persistentes
    const lsKeys = [
      this.sessionNameValue,
      'UserAssign', 'DocumentInMemories', 'CurrentSession', 'Ports',
      'Menu', 'LocalPrinter', 'ReportManager', 'UserInfo', 'Companies',
      'FavoriteCompany'
    ]
    lsKeys.forEach(key => localStorage.removeItem(key))

    // sessionStorage — datos por pestaña
    sessionStorage.removeItem('CurrentCompany')
    sessionStorage.removeItem('Permissions')
    sessionStorage.removeItem('currentFEUser')
  }

  #redirectToLogin() {
    window.location.href = this.loginPathValue
  }
}
