import { Controller } from '@hotwired/stimulus'
import { Storage } from 'vendor/clavisco/core'

/**
 * UserMenuController — Menú de usuario del toolbar.
 *
 * Ícono de usuario alineado al final del toolbar:
 *  - Hover → tooltip con el nombre de usuario.
 *  - Click → menú flotante (mismo patrón que el context menu de compañía).
 *  - Opción "Perfil de usuario" → navega a /configurations/user-profile.
 *
 * El toolbar NO es data-turbo-permanent: este controller reconecta en cada
 * visita Turbo, por eso el nombre se lee de la sesión en connect().
 */
export default class extends Controller {
  static targets = ['menu', 'tooltip', 'username', 'initial']

  #dismissHandler = null

  connect() {
    this.#setUsername()
  }

  disconnect() {
    this.#closeMenu()
  }

  toggle(event) {
    event.stopPropagation()
    if (!this.hasMenuTarget) return

    const isHidden = this.menuTarget.classList.contains('hidden')
    if (isHidden) this.#openMenu()
    else this.#closeMenu()
  }

  goToProfile() {
    this.#closeMenu()
    if (window.Turbo) window.Turbo.visit('/configurations/user-profile')
    else window.location.href = '/configurations/user-profile'
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  #setUsername() {
    const session = Storage.get('Session')
    const name = session?.UserEmail ?? ''
    if (this.hasUsernameTarget) this.usernameTarget.textContent = name
    if (this.hasTooltipTarget) this.tooltipTarget.textContent = name
    if (this.hasInitialTarget) this.initialTarget.textContent = name ? name.charAt(0).toUpperCase() : '?'
  }

  #openMenu() {
    this.menuTarget.classList.remove('hidden')
    // Cerrar al hacer click en cualquier otro lugar
    this.#dismissHandler = () => this.#closeMenu()
    document.addEventListener('click', this.#dismissHandler, { once: true })
  }

  #closeMenu() {
    if (this.hasMenuTarget) this.menuTarget.classList.add('hidden')
    if (this.#dismissHandler) {
      document.removeEventListener('click', this.#dismissHandler)
      this.#dismissHandler = null
    }
  }
}
