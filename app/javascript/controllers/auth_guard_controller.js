import { Controller } from '@hotwired/stimulus'

// Replica el VerifyUserTokenGuard de Angular.
// Agregar data-controller="auth-guard" en el layout de cualquier página protegida.
export default class extends Controller {
  static values = {
    loginPath:   { type: String, default: '/login' },
    sessionName: { type: String, default: 'Session' }
  }

  connect() {
    this.#checkAuth()
  }

  // Logout explícito (llamar desde el menú)
  logout() {
    this.#clearSession()
    this.#redirectToLogin()
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  #checkAuth() {
    const session = this.#getSession()

    if (!session || !session.access_token) {
      this.#redirectToLogin()
      return
    }

    // expires_at viene del JWT exp (Unix timestamp en ms), sin ambigüedad de formato de fecha
    const expiresAt = session.expires_at ?? null

    if (expiresAt && Date.now() >= expiresAt) {
      this.#clearSession()
      this.#redirectToLogin()
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
