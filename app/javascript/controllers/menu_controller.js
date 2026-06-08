import { Controller } from '@hotwired/stimulus'
import { Storage, SStore, getApiHeaders } from 'vendor/clavisco/core'

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
  // Definición completa del menú (equivalente a menu.service.ts)
  // ---------------------------------------------------------------------------
  static MENU_NODES = [
    {
      key: 'home',
      label: 'Inicio',
      icon: 'house',
      route: '/home',
      visible: true,
      nodes: []
    },
    {
      key: 'documents',
      label: 'Documentos',
      icon: 'folder_open',
      route: null,
      visible: false,
      requiredPermission: 'M_Documents',
      nodes: [
        { key: 'issued_documents',    label: 'Documentos Emitidos',          route: '/documents/issued',           requiredPermission: 'Documents_Issued_ViewDocuments' },
        { key: 'accept_documents',    label: 'Aceptación Documentos',        route: '/documents/receptions',       requiredPermission: 'Documents_Reception_ViewDocuments' },
        { key: 'accept_documents_gt', label: 'Aceptación Documentos GT',     route: '/documents/gt/receptions',    requiredPermission: 'S_AcceptDocsGT' },
        { key: 'reception_documents', label: 'Recepción Documentos',         route: '/reception_documents',        requiredPermission: 'S_ReceptDocs' },
        { key: 'mailParser',          label: 'Logs de Correo de Recepción',  route: '/mailParser',                 requiredPermission: 'S_MailParserLogs' },
        { key: 'email_report',        label: 'Reporte de correos',           route: '/email_report',               requiredPermission: 'S_EmailReport' },
        { key: 'createFE',            label: 'Creación FE',                  route: '/createDocument/01',          requiredPermission: 'S_CreateDocsFE' },
        { key: 'createND',            label: 'Creación ND',                  route: '/createDocument/02',          requiredPermission: 'S_CreateDocsND' },
        { key: 'createNC',            label: 'Creación NC',                  route: '/createDocument/03',          requiredPermission: 'S_CreateDocsNC' },
        { key: 'createFEC',           label: 'Creación FEC',                 route: '/createDocument/08',          requiredPermission: 'S_CreateDocsFEC' },
        { key: 'createREP',           label: 'Creación REP',                 route: '/createDocument/10',          requiredPermission: 'S_CreateDocsREP' },
      ]
    },
    {
      key: 'reports',
      label: 'Reportes',
      icon: 'print',
      route: '/docReport',
      visible: false,
      requiredPermission: ['S_DocumentReport', 'S_DocumentReceptionReport'],
      nodes: []
    },
    {
      key: 'settings',
      label: 'Configuración',
      icon: 'settings_suggest',
      route: null,
      visible: false,
      requiredPermission: 'M_Config',
      nodes: [
        { key: 'user-profile',       label: 'Perfil de Usuario',                route: '/configurations/user-profile',     requiredPermission: 'S_UpdateUserInfo' },
        { key: 'company',            label: 'Compañías',                        route: '/configurations/companies',        requiredPermission: 'S_Company' },
        { key: 'connections',        label: 'Conexiones',                       route: '/configurations/connections',      requiredPermission: 'Configurations_Connections_Access' },
        { key: 'udfs',               label: 'UDFs',                             route: '/udfs',                            requiredPermission: 'S_Udfs' },
        { key: 'users',              label: 'Usuarios',                         route: '/configurations/users',            requiredPermission: 'Configurations_Users_Access' },
        { key: 'groups',             label: 'Grupos',                           route: '/configurations/group',            requiredPermission: 'S_Groups' },
        { key: 'numbering',          label: 'Numeración',                       route: '/configurations/numbering',        requiredPermission: 'S_Numbering' },
        { key: 'permissions',        label: 'Permisos',                         route: '/configurations/permissions',      requiredPermission: 'Configurations_Permissions_Access' },
        { key: 'Rol',                label: 'Roles',                            route: '/configurations/roles',            requiredPermission: 'S_Rols' },
        { key: 'rolUserCompany',     label: 'Roles por usuario',                route: '/rolUserCompany',                  requiredPermission: 'S_RolByUser' },
        { key: 'sucursal',           label: 'Sucursal',                         route: '/sucursal',                        requiredPermission: 'S_Sucursal' },
        { key: 'wizardSetup',        label: 'Asistente de Configuración',       route: '/wizard-setup',                    requiredPermission: 'Configurations_WizardSetup_Access' },
        { key: 'mailParserConfig',   label: 'Procesador de Correos',            route: '/configurations/mail-parser',      requiredPermission: ['Configurations_MailParser_ViewConfigurations', 'Configurations_MailParser_ViewAllConfigurationsInApplication'] },
        { key: 'emailInbox',         label: 'Asignación de bandejas',           route: '/emailInbox',                      requiredPermission: 'Maintenance_EmailInbox_Access' },
        { key: 'userHelp',           label: 'Enlaces de documentación',         route: '/user-help',                       requiredPermission: 'Configurations_UserHelp_Access' },
        { key: 'generalConfigs',     label: 'Generales',                        route: '/configurations/general',          requiredPermission: 'Configurations_General_Access' },
      ]
    },
    {
      key: 'textFilesLogs',
      label: 'Logs',
      icon: 'terminal',
      route: '/logs',
      visible: false,
      requiredPermission: 'Logs_Access',
      nodes: []
    },
    {
      key: 'logout',
      label: 'Cerrar sesión',
      icon: 'logout',
      route: '/login',
      visible: true,
      nodes: []
    }
  ]

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

  #logout() {
    // localStorage — datos persistentes entre pestañas
    const lsKeys = [
      'Session', 'UserAssign', 'DocumentInMemories', 'CurrentSession',
      'Ports', 'Menu', 'LocalPrinter', 'ReportManager', 'UserInfo',
      'Companies', 'menuState', 'BannerUser'
    ]
    lsKeys.forEach(k => localStorage.removeItem(k))

    // sessionStorage — datos por pestaña (empresa + permisos)
    sessionStorage.removeItem('CurrentCompany')
    sessionStorage.removeItem('Permissions')

    window.location.href = '/login'
  }
}
