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

    // Verificar expiración — soporta tanto ".expires" (legacy .NET) como "expires_at" (vendor Rails)
    const expiresAt = session['.expires']
      ? new Date(session['.expires']).getTime()
      : session.expires_at

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
    // Limpia todas las claves de sesión (equivalente a SharedService.Logout del legacy)
    const keys = [
      this.sessionNameValue,
      'CurrentCompany',
      'UserAssign',
      'DocumentInMemories',
      'CurrentSession',
      'Ports',
      'Permissions',
      'Menu',
      'LocalPrinter',
      'ReportManager',
      'UserInfo',
      'Companies'
    ]
    keys.forEach(key => localStorage.removeItem(key))
  }

  #redirectToLogin() {
    window.location.href = this.loginPathValue
  }
}
