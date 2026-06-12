import { Controller } from '@hotwired/stimulus'
import { Storage, SStore, getApiHeaders } from 'vendor/clavisco/core'
import { confirm } from 'vendor/clavisco/alerts'
import { notifySessionClosed, thereAreMultipleContexts, clearSession } from 'vendor/clavisco/session-sync'
import MENU_NODES from 'data/menu'

/**
 * MenuController — Sidebar + Toolbar del layout protegido.
 *
 * Responsabilidades:
 *  - Renderizar nodos del menú según permisos del usuario
 *  - Toggle collapse del sidebar
 *  - Navegación entre rutas
 *  - Logout (limpia sesión y redirige a /login)
 *  - Mostrar username y título de página actual
 */
export default class extends Controller {
  static targets = ['sidebar', 'username', 'nav', 'pageTitle']

  static values = {
    pageTitle: { type: String, default: '' }
  }

  // ---------------------------------------------------------------------------
  // Definición del menú — single source of truth en docs/menu.json
  // ---------------------------------------------------------------------------
  static MENU_NODES = MENU_NODES

  // Estado interno de grupos expandidos
  #expandedGroups = new Set()

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connect() {
    this.#setUsername()
    this.#setPageTitle()
    this.#loadPermissionsAndRender()
    this.#restoreCollapseState()
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  toggleSidebar() {
    const collapsed = this.sidebarTarget.dataset.collapsed === 'true'
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

  #setPageTitle() {
    if (!this.hasPageTitleTarget) return
    this.pageTitleTarget.textContent = this.pageTitleValue
  }

  #restoreCollapseState() {
    const state = Storage.get('menuState')
    if (state?.isCollapsed) this.#setCollapsed(true)
  }

  #setCollapsed(collapsed) {
    if (!this.hasSidebarTarget) return
    this.sidebarTarget.dataset.collapsed = String(collapsed)

    if (collapsed) {
      this.sidebarTarget.classList.replace('w-64', 'w-16')
    } else {
      this.sidebarTarget.classList.replace('w-16', 'w-64')
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
      chevron.style.transform = ''
    } else {
      this.#expandedGroups.add(key)
      subList.classList.remove('hidden')
      chevron.style.transform = 'rotate(90deg)'
    }
  }

  #navigate(node) {
    if (node.key === 'logout') {
      this.#logout()
      return
    }
    if (node.route) {
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
