import { Controller } from '@hotwired/stimulus'
import { Storage, SStore, getApiHeaders } from 'vendor/clavisco/core'
import { confirm } from 'vendor/clavisco/alerts'
import { notifySessionClosed, thereAreMultipleContexts, clearSession } from 'vendor/clavisco/session-sync'
import MENU_NODES from 'data/menu'

/**
 * MenuController — Sidebar del layout protegido.
 *
 * El <aside> que lo monta es `data-turbo-permanent`: Turbo conserva ese nodo DOM
 * entre visitas y Stimulus NO reconecta este controller. Por eso `#expandedGroups`
 * vive en memoria y los nodos padre expandidos sobreviven a la navegación —
 * el mismo modelo de shell persistente que el app.component de Angular, sin
 * necesidad de persistir el estado en storage.
 *
 * Implicaciones del montaje en el <aside>:
 *  - `connect()` corre UNA sola vez por sesión de página (no en cada navegación).
 *    Solo se vuelve a ejecutar tras un reload real (F5, cambio de empresa, login).
 *  - El botón de toggle vive en el toolbar, FUERA del scope de este controller →
 *    se enlaza con un listener delegado en `document` (sobrevive a los swaps de Turbo).
 *  - El resaltado de la opción activa se recalcula en cada `turbo:load` porque el
 *    menú ya no se re-renderiza al navegar.
 *
 * Responsabilidades:
 *  - Renderizar nodos del menú según permisos del usuario (una sola vez)
 *  - Toggle collapse del sidebar
 *  - Navegación entre rutas vía Turbo Drive (sin full reload)
 *  - Resaltar la opción activa y abrir su grupo padre
 *  - Logout (limpia sesión y redirige a /login)
 *  - Mostrar username
 */
export default class extends Controller {
  static targets = ['username', 'nav']

  // ---------------------------------------------------------------------------
  // Definición del menú — single source of truth en docs/menu.json
  // ---------------------------------------------------------------------------
  static MENU_NODES = MENU_NODES

  // Estado interno de grupos expandidos — sobrevive en memoria (aside permanente)
  #expandedGroups = new Set()

  // Handlers enlazados (para poder removerlos en disconnect)
  #onToggleClick = null
  #onTurboLoad = null

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connect() {
    this.#setUsername()
    this.#restoreCollapseState()
    this.#loadPermissionsAndRender()

    // Toggle del sidebar: el botón está en el toolbar (fuera de este scope).
    // Listener delegado en document → resiste los reemplazos de body de Turbo.
    this.#onToggleClick = (event) => {
      if (event.target.closest('[data-menu-toggle]')) this.toggleSidebar()
    }
    document.addEventListener('click', this.#onToggleClick)

    // El menú no se re-renderiza al navegar: refrescar el resaltado en cada visita.
    this.#onTurboLoad = () => this.#highlightActive()
    document.addEventListener('turbo:load', this.#onTurboLoad)
  }

  disconnect() {
    if (this.#onToggleClick) document.removeEventListener('click', this.#onToggleClick)
    if (this.#onTurboLoad) document.removeEventListener('turbo:load', this.#onTurboLoad)
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  toggleSidebar() {
    const collapsed = this.element.dataset.collapsed === 'true'
    this.#setCollapsed(!collapsed)
    Storage.set('menuState', { isCollapsed: !collapsed })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  #setUsername() {
    if (!this.hasUsernameTarget) return
    const session = Storage.get('Session')
    this.usernameTarget.textContent = session?.UserEmail ?? ''
  }

  #restoreCollapseState() {
    const state = Storage.get('menuState')
    if (state?.isCollapsed) this.#setCollapsed(true)
  }

  #setCollapsed(collapsed) {
    // this.element ES el <aside> (el controller se monta directo sobre el sidebar).
    this.element.dataset.collapsed = String(collapsed)

    if (collapsed) {
      this.element.classList.replace('w-64', 'w-16')
    } else {
      this.element.classList.replace('w-16', 'w-64')
    }
  }

  async #loadPermissionsAndRender() {
    const company  = SStore.get('CurrentCompany')
    let permissions = SStore.get('Permissions') // array de strings — sessionStorage (per-tab)

    // Si no hay permisos en caché, cargarlos del API
    if (!permissions && company?.companyId) {
      permissions = await this.#fetchPermissions(company.companyId)
    }

    const permSet = new Set(Array.isArray(permissions) ? permissions : [])
    this.#renderMenu(permSet)
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

  /**
   * Aplica lógica de visibilidad idéntica a menu.service.ts
   * @param {Set<string>} permSet
   */
  #buildVisibleNodes(permSet) {
    return this.constructor.MENU_NODES.map(node => {
      // home y logout siempre visibles
      if (node.key === 'home' || node.key === 'logout') {
        return { ...node, visible: true }
      }

      const hasPermission = (req) => {
        if (!req) return false
        return Array.isArray(req)
          ? req.some(p => permSet.has(p))
          : permSet.has(req)
      }

      // Nodos hijo visibles
      const visibleChildren = (node.nodes ?? []).filter(child =>
        hasPermission(child.requiredPermission)
      )

      // Padre visible si tiene su propio permiso O algún hijo tiene permiso
      const parentVisible = hasPermission(node.requiredPermission) || visibleChildren.length > 0

      return {
        ...node,
        visible: parentVisible,
        nodes: visibleChildren
      }
    })
  }

  #renderMenu(permSet) {
    if (!this.hasNavTarget) return
    const nodes = this.#buildVisibleNodes(permSet)
    this.navTarget.innerHTML = ''

    nodes.forEach(node => {
      if (!node.visible) return
      const el = this.#createNodeElement(node)
      this.navTarget.appendChild(el)
    })

    // Tras el render inicial, resaltar la ruta actual y abrir su grupo padre.
    this.#highlightActive()
  }

  #createNodeElement(node) {
    const hasChildren = node.nodes?.length > 0

    const wrapper = document.createElement('div')

    // Botón del ítem principal
    const btn = document.createElement('button')
    btn.dataset.testid = `menu-item-${node.key}`
    btn.className = [
      'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300',
      'hover:bg-gray-700 hover:text-white transition-colors text-left'
    ].join(' ')

    // Icono
    if (node.icon) {
      const icon = document.createElement('span')
      icon.className = 'material-icons text-lg flex-shrink-0'
      icon.textContent = node.icon
      btn.appendChild(icon)
    }

    // Label (oculto cuando sidebar colapsa)
    const label = document.createElement('span')
    label.className = 'truncate flex-1 sidebar-label'
    label.textContent = node.label
    btn.appendChild(label)

    if (hasChildren) {
      // Chevron — se agrega al btn antes de crear subList
      const chevron = document.createElement('span')
      chevron.className = 'material-icons text-base transition-transform sidebar-label'
      chevron.textContent = 'chevron_right'
      chevron.dataset.chevron = node.key
      btn.appendChild(chevron)

      // subList declarado aquí para que el listener lo capture en su closure
      const subList = document.createElement('div')
      subList.className = 'hidden bg-gray-800 pl-4'
      subList.dataset.group = node.key

      btn.addEventListener('click', () => this.#toggleGroup(node.key, subList, chevron))

      node.nodes.forEach(child => {
        const childBtn = document.createElement('button')
        childBtn.dataset.testid = `menu-item-${child.key}`
        // data-route habilita el resaltado de la opción activa (#highlightActive)
        if (child.route) childBtn.dataset.route = child.route
        childBtn.className = [
          'w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-400',
          'hover:bg-gray-700 hover:text-white transition-colors text-left'
        ].join(' ')
        childBtn.textContent = child.label
        childBtn.addEventListener('click', () => this.#navigate(child))
        subList.appendChild(childBtn)
      })

      wrapper.appendChild(btn)
      wrapper.appendChild(subList)
    } else {
      if (node.route) {
        btn.dataset.route = node.route
        btn.addEventListener('click', () => this.#navigate(node))
      }
      wrapper.appendChild(btn)
    }

    return wrapper
  }

  #toggleGroup(key, subList, chevron) {
    const isOpen = this.#expandedGroups.has(key)
    if (isOpen) {
      this.#expandedGroups.delete(key)
      subList.classList.add('hidden')
      if (chevron) chevron.style.transform = ''
    } else {
      this.#expandedGroups.add(key)
      subList.classList.remove('hidden')
      if (chevron) chevron.style.transform = 'rotate(90deg)'
    }
  }

  /**
   * Resalta la opción cuya ruta coincide con la URL actual y, si está dentro de
   * un grupo colapsado, lo expande. Se llama tras el render y en cada turbo:load.
   */
  #highlightActive() {
    if (!this.hasNavTarget) return

    const path = window.location.pathname
    const ACTIVE = ['bg-gray-700', 'text-white']

    // Limpiar resaltado previo
    this.navTarget.querySelectorAll('[data-route]').forEach(b => b.classList.remove(...ACTIVE))

    const active = this.navTarget.querySelector(`[data-route="${path}"]`)
    if (!active) return
    active.classList.add(...ACTIVE)

    // Si la opción activa vive en un grupo colapsado, abrirlo.
    const subList = active.closest('[data-group]')
    if (subList && subList.classList.contains('hidden')) {
      const key = subList.dataset.group
      const chevron = this.navTarget.querySelector(`[data-chevron="${key}"]`)
      this.#toggleGroup(key, subList, chevron)
    }
  }

  #navigate(node) {
    if (node.key === 'logout') {
      this.#logout()
      return
    }
    if (!node.route) return

    // Turbo Drive: navega sin full reload, así el <aside> permanente conserva
    // su instancia y el estado de grupos expandidos. Fallback defensivo a location.
    if (window.Turbo) {
      window.Turbo.visit(node.route)
    } else {
      window.location.href = node.route
    }
  }

  async #logout() {
    const multiple = await thereAreMultipleContexts()

    const message = multiple
      ? 'Se han detectado múltiples pestañas abiertas. Al continuar se cerrará la sesión en todas ellas.'
      : '¿Está seguro de que desea cerrar sesión?'
    const title = multiple ? 'Múltiples pestañas abiertas' : 'Cerrar sesión'

    const confirmed = await confirm(message, title)
    if (!confirmed) return

    // Notificar a las demás pestañas antes de limpiar (flujo B del análisis)
    if (multiple) notifySessionClosed()

    clearSession()
    window.location.href = '/login'
  }
}
