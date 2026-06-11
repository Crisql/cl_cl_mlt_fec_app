import { Controller } from '@hotwired/stimulus'
import { Storage, SStore } from 'vendor/clavisco/core'
import { showToast } from 'vendor/clavisco/alerts'
import { showLoading, hideLoading } from 'vendor/clavisco/overlay'

/**
 * PermissionsController — Gestión de permisos (By-Role y Global).
 *
 * Equivalente Angular:
 *   - PermissionsComponent     → tabs, filtrado por permisos, routing
 *   - PermsByRolComponent      → tab by-role (drag&drop, roles, perms)
 *   - GlobalPermsComponent     → tab global (autocomplete, drag&drop)
 */
export default class extends Controller {
  static targets = [
    // Tabs
    'tabByRole', 'tabGlobal',
    'panelByRole', 'panelGlobal',

    // By-Role
    'roleSelect', 'dragDropPanel', 'emptyRoleState',
    'unassignedList', 'assignedList',
    'emptyUnassigned', 'emptyAssigned',
    'unassignedCount', 'assignedCount',
    'btnAssignAll', 'btnUnassignAll',
    'changesBadge', 'changesBadgeValue',
    'changesSummary',
    'assignSummaryRow', 'unassignSummaryRow',
    'assignCount', 'unassignCount',
    'btnCancel', 'btnSave',

    // Global
    'userSearch', 'userDropdown',
    'dragDropPanelGlobal', 'emptyUserState',
    'unassignedListGlobal', 'assignedListGlobal',
    'emptyUnassignedGlobal', 'emptyAssignedGlobal',
    'unassignedCountGlobal', 'assignedCountGlobal',
    'btnAssignAllGlobal', 'btnUnassignAllGlobal',
    'changesBadgeGlobal', 'changesBadgeValueGlobal',
    'changesSummaryGlobal',
    'assignSummaryRowGlobal', 'unassignSummaryRowGlobal',
    'assignCountGlobal', 'unassignCountGlobal',
    'btnCancelGlobal', 'btnApply',

    // Modal de error
    'errorModal', 'errorTitle', 'errorSubtitle',
  ]

  static values = {
    byRoleUrl: String,
    globalUrl: String
  }

  // ----------------------------------------------------------------
  // Estado: By-Role
  // ----------------------------------------------------------------
  #rolesList = []
  #allPermsList = []
  #assignedPerms = []
  #unassignedPerms = []
  #permsByRolList = []
  #idRol = null
  #initialAssignedIds = new Set()
  #currentAssignedIds = new Set()
  #permIdsToAssign = []
  #permIdsToUnassign = []
  #hasByRoleChanges = false

  // Estado drag (by-role)
  #draggedPermId = null
  #draggedFromZone = null

  // ----------------------------------------------------------------
  // Estado: Global
  // ----------------------------------------------------------------
  #usersList = []
  #allGlobalPermsList = []
  #assignedGlobalPerms = []
  #unassignedGlobalPerms = []
  #selectedUserId = null
  #initialAssignedGlobalIds = new Set()
  #currentAssignedGlobalIds = new Set()
  #permIdsToAssignGlobal = []
  #permIdsToUnassignGlobal = []
  #hasGlobalChanges = false
  #draggedGlobalPermId = null
  #draggedFromGlobalZone = null

  // Tabs disponibles según permisos
  #availableTabs = []
  #activeTab = null

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  connect() {
    this.#setupTabsFromPermissions()

    if (this.#availableTabs.length === 0) {
      window.location.href = '/home'
      return
    }

    this.#activateTabFromURL()

    // Escuchar cambio de empresa
    window.addEventListener('storage', this.#onStorageChange.bind(this))
  }

  disconnect() {
    window.removeEventListener('storage', this.#onStorageChange.bind(this))
  }

  // ----------------------------------------------------------------
  // Tabs
  // ----------------------------------------------------------------
  #setupTabsFromPermissions() {
    const userPerms = SStore.get('Permissions') || []

    const TAB_CONFIGS = [
      {
        id: 'by-role',
        permission: 'Configurations_Permissions_Access',
        tabTarget: 'tabByRole',
        panelTarget: 'panelByRole'
      },
      {
        id: 'global',
        permission: 'Configurations_Permissions_GlobalAccess',
        tabTarget: 'tabGlobal',
        panelTarget: 'panelGlobal'
      }
    ]

    this.#availableTabs = TAB_CONFIGS.filter(cfg => {
      const hasPermission = userPerms.includes(cfg.permission)
      if (hasPermission) {
        this[`${cfg.tabTarget}Target`].classList.remove('hidden')
      }
      return hasPermission
    })
  }

  #activateTabFromURL() {
    const pathSegment = window.location.pathname.split('/').pop()
    const matchedTab = this.#availableTabs.find(t => t.id === pathSegment)
    const targetTab = matchedTab || this.#availableTabs[0]

    if (!targetTab) return

    if (!matchedTab) {
      history.replaceState(null, '', `/configurations/permissions/${targetTab.id}`)
    }

    this.#activateTab(targetTab.id)
  }

  #activateTab(tabId) {
    this.#activeTab = tabId

    this.#availableTabs.forEach(cfg => {
      const tabEl = this[`${cfg.tabTarget}Target`]
      const panelEl = this[`${cfg.panelTarget}Target`]
      const isActive = cfg.id === tabId

      // Tab button styles
      tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false')
      tabEl.classList.toggle('border-blue-600', isActive)
      tabEl.classList.toggle('text-blue-600', isActive)
      tabEl.classList.toggle('border-transparent', !isActive)
      tabEl.classList.toggle('text-gray-500', !isActive)

      // Panel visibility
      panelEl.classList.toggle('hidden', !isActive)
    })

    // Cargar datos del tab activado
    if (tabId === 'by-role' && this.#rolesList.length === 0) {
      this.#loadByRoleData()
    } else if (tabId === 'global' && this.#usersList.length === 0) {
      this.#loadGlobalData()
    }
  }

  switchToByRole() {
    history.pushState(null, '', this.byRoleUrlValue)
    this.#activateTab('by-role')
  }

  switchToGlobal() {
    history.pushState(null, '', this.globalUrlValue)
    this.#activateTab('global')
  }

  #onStorageChange(event) {
    if (event.key === 'CurrentCompany') {
      // Recargar datos según tab activo
      if (this.#activeTab === 'by-role') {
        this.#resetByRoleState()
        this.#loadByRoleData()
      } else if (this.#activeTab === 'global') {
        this.#resetGlobalState()
        this.#loadGlobalData()
      }
    }
  }

  // ----------------------------------------------------------------
  // BY-ROLE: Carga de datos
  // ----------------------------------------------------------------
  async #loadByRoleData() {
    const company = SStore.get('CurrentCompany') || {}

    this.#showOverlay('Cargando datos...')

    try {
      const [rolesRes, permsRes] = await Promise.all([
        this.#apiFetch(`/api/Rol/GetRoles?companyId=${company.companyId}`),
        this.#apiFetch('/api/Permission/GetPermissions')
      ])

      // Permisos
      if (permsRes.Data && permsRes.Data.length) {
        this.#allPermsList = permsRes.Data
      } else {
        showToast(permsRes.Message || 'No se pudieron cargar los permisos', 'warning')
      }

      // Roles (filtrar OWNER)
      if (rolesRes.Data && rolesRes.Data.length) {
        this.#rolesList = rolesRes.Data.filter(r => r.Name.toUpperCase() !== 'OWNER')
        this.#populateRoleSelect()

        // Seleccionar primer rol
        if (this.#rolesList.length > 0) {
          const firstId = this.#rolesList[0].Id
          this.roleSelectTarget.value = String(firstId)
          this.#idRol = firstId
          await this.#loadPermsByRol()
        }
      } else {
        showToast('No posee roles para asignarle permisos!!!', 'warning')
        this.#showEmptyRoleState()
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar datos', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  #populateRoleSelect() {
    const select = this.roleSelectTarget
    select.innerHTML = '<option value="">— Seleccione —</option>'
    this.#rolesList.forEach(role => {
      const opt = document.createElement('option')
      opt.value = role.Id
      opt.textContent = role.Name
      select.appendChild(opt)
    })
  }

  async #loadPermsByRol() {
    if (!this.#idRol) return

    try {
      const res = await this.#apiFetch(`/api/Permission/GetPermissionsByRol?idRol=${this.#idRol}`)
      this.#clearPermLists()

      if (res.Data && res.Data.length) {
        const assignedSet = new Set(res.Data)

        this.#allPermsList.forEach(perm => {
          const copy = { ...perm }
          if (assignedSet.has(perm.Id)) {
            this.#assignedPerms.push(copy)
            this.#initialAssignedIds.add(perm.Id)
            this.#currentAssignedIds.add(perm.Id)
          } else {
            this.#unassignedPerms.push(copy)
          }
        })
      } else {
        this.#unassignedPerms = this.#allPermsList.map(p => ({ ...p }))
      }

      this.#renderPermLists()
      this.#showDragDropPanel()
    } catch (err) {
      showToast(err.message || 'Error al cargar permisos del rol', 'error')
    }
  }

  // ----------------------------------------------------------------
  // BY-ROLE: Eventos
  // ----------------------------------------------------------------
  async onRoleChange(event) {
    const id = parseInt(event.target.value)
    if (!id) {
      this.#idRol = null
      this.#showEmptyRoleState()
      return
    }
    this.#idRol = id
    await this.#loadPermsByRol()
  }

  assignAll() {
    this.#unassignedPerms.forEach(p => {
      this.#assignedPerms.push(p)
      this.#currentAssignedIds.add(p.Id)
    })
    this.#unassignedPerms = []
    this.#calculateChanges()
    this.#renderPermLists()
  }

  unassignAll() {
    this.#assignedPerms.forEach(p => {
      this.#unassignedPerms.push(p)
      this.#currentAssignedIds.delete(p.Id)
    })
    this.#assignedPerms = []
    this.#calculateChanges()
    this.#renderPermLists()
  }

  async cancelChanges() {
    await this.#loadPermsByRol()
  }

  async saveChanges() {
    if (!this.#hasByRoleChanges) {
      showToast('No hay cambios para guardar', 'info')
      return
    }

    const permByRolList = this.#assignedPerms.map(p => ({
      Id: 0,
      PermId: p.Id,
      RolId: this.#idRol,
      Active: true
    }))

    this.#showOverlay('Guardando permisos, espere por favor...')

    try {
      await this.#apiFetch('/api/Permission/AssignPermByRol', {
        method: 'POST',
        body: JSON.stringify({ permByRolList, idRol: this.#idRol })
      })

      showToast('Permisos asignados con éxito!!!', 'success')

      // Sincronizar estado inicial
      this.#initialAssignedIds.clear()
      this.#currentAssignedIds.forEach(id => this.#initialAssignedIds.add(id))
      this.#permIdsToAssign = []
      this.#permIdsToUnassign = []
      this.#hasByRoleChanges = false
      this.#updateChangesUI()

      // Refrescar permisos del usuario y recargar
      const company = SStore.get('CurrentCompany') || {}
      await this.#apiFetch(`/api/Permission/GetPermsByUser?companyId=${company.companyId}`)
      window.location.reload()
    } catch (err) {
      this.#showErrorModal('Error al guardar permisos', err.message || 'Error desconocido')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // BY-ROLE: Drag & Drop
  // ----------------------------------------------------------------
  onDragOver(event) {
    event.preventDefault()
    event.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
  }

  onDrop(event) {
    event.preventDefault()
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')

    const targetZone = event.currentTarget.dataset.dropZone
    if (!this.#draggedPermId || this.#draggedFromZone === targetZone) return

    const permId = this.#draggedPermId

    if (targetZone === 'assigned') {
      const idx = this.#unassignedPerms.findIndex(p => p.Id === permId)
      if (idx !== -1) {
        const [perm] = this.#unassignedPerms.splice(idx, 1)
        this.#assignedPerms.push(perm)
        this.#currentAssignedIds.add(permId)
      }
    } else {
      const idx = this.#assignedPerms.findIndex(p => p.Id === permId)
      if (idx !== -1) {
        const [perm] = this.#assignedPerms.splice(idx, 1)
        this.#unassignedPerms.push(perm)
        this.#currentAssignedIds.delete(permId)
      }
    }

    this.#calculateChanges()
    this.#renderPermLists()
    this.#draggedPermId = null
    this.#draggedFromZone = null
  }

  // ----------------------------------------------------------------
  // BY-ROLE: Render
  // ----------------------------------------------------------------
  #renderPermLists() {
    this.#renderList(
      this.unassignedListTarget,
      this.emptyUnassignedTarget,
      this.#unassignedPerms,
      'unassigned',
      false
    )
    this.#renderList(
      this.assignedListTarget,
      this.emptyAssignedTarget,
      this.#assignedPerms,
      'assigned',
      true
    )
    this.#updateCounts(
      this.unassignedCountTarget,
      this.assignedCountTarget,
      this.#unassignedPerms.length,
      this.#assignedPerms.length
    )
    this.#updateBulkButtons(
      this.btnAssignAllTarget,
      this.btnUnassignAllTarget,
      this.#unassignedPerms.length,
      this.#assignedPerms.length
    )
    this.#updateChangesUI()
  }

  #renderList(container, emptyEl, perms, zone, isAssigned) {
    // Mantener empty state; limpiar items previos
    const existingItems = container.querySelectorAll('[data-perm-item]')
    existingItems.forEach(el => el.remove())

    if (perms.length === 0) {
      emptyEl.classList.remove('hidden')
      emptyEl.classList.add('flex')
    } else {
      emptyEl.classList.add('hidden')
      emptyEl.classList.remove('flex')

      perms.forEach(perm => {
        const item = this.#createPermItem(perm, zone, isAssigned)
        container.appendChild(item)
      })
    }
  }

  #createPermItem(perm, zone, isAssigned) {
    const div = document.createElement('div')
    div.dataset.permItem = true
    div.dataset.permId = perm.Id
    div.dataset.testid = `perm-item-${perm.Id}`
    div.draggable = true
    div.className = `flex items-center gap-3 p-3 mb-2 bg-white border rounded-lg cursor-move
      transition-all hover:shadow-md hover:-translate-y-0.5
      ${isAssigned ? 'border-l-4 border-l-green-400 border-gray-200' : 'border-gray-200'}`

    div.innerHTML = `
      <div class="text-gray-400 cursor-grab">
        <span class="material-icons text-xl">drag_indicator</span>
      </div>
      <div class="flex flex-col flex-1 gap-0.5">
        <span data-testid="perm-name" class="font-medium text-gray-800 text-sm">${this.#escapeHtml(perm.Description)}</span>
        <span data-testid="perm-id" class="text-xs text-gray-400">#${perm.Id}</span>
      </div>
    `

    div.addEventListener('dragstart', () => {
      this.#draggedPermId = perm.Id
      this.#draggedFromZone = zone
      div.classList.add('opacity-50')
    })
    div.addEventListener('dragend', () => {
      div.classList.remove('opacity-50')
    })

    return div
  }

  #updateCounts(unassignedEl, assignedEl, unassignedCount, assignedCount) {
    unassignedEl.textContent = unassignedCount
    assignedEl.textContent = assignedCount
  }

  #updateBulkButtons(btnAssign, btnUnassign, unassignedCount, assignedCount) {
    btnAssign.disabled = unassignedCount === 0
    btnUnassign.disabled = assignedCount === 0
  }

  #calculateChanges() {
    this.#permIdsToAssign = []
    this.#permIdsToUnassign = []

    this.#currentAssignedIds.forEach(id => {
      if (!this.#initialAssignedIds.has(id)) this.#permIdsToAssign.push(id)
    })
    this.#initialAssignedIds.forEach(id => {
      if (!this.#currentAssignedIds.has(id)) this.#permIdsToUnassign.push(id)
    })

    this.#hasByRoleChanges = this.#permIdsToAssign.length > 0 || this.#permIdsToUnassign.length > 0
  }

  #updateChangesUI() {
    const total = this.#permIdsToAssign.length + this.#permIdsToUnassign.length

    // Badge
    if (this.#idRol) {
      this.changesBadgeTarget.classList.remove('hidden')
      this.changesBadgeTarget.classList.add('flex')
      this.changesBadgeValueTarget.textContent = total
      this.changesBadgeValueTarget.classList.toggle('text-orange-500', this.#hasByRoleChanges)
      this.changesBadgeValueTarget.classList.toggle('text-gray-400', !this.#hasByRoleChanges)
    }

    // Summary
    if (this.#hasByRoleChanges) {
      this.changesSummaryTarget.classList.remove('hidden')

      if (this.#permIdsToAssign.length > 0) {
        this.assignSummaryRowTarget.classList.remove('hidden')
        this.assignSummaryRowTarget.classList.add('flex')
        this.assignCountTarget.textContent = this.#permIdsToAssign.length
      } else {
        this.assignSummaryRowTarget.classList.add('hidden')
        this.assignSummaryRowTarget.classList.remove('flex')
      }

      if (this.#permIdsToUnassign.length > 0) {
        this.unassignSummaryRowTarget.classList.remove('hidden')
        this.unassignSummaryRowTarget.classList.add('flex')
        this.unassignCountTarget.textContent = this.#permIdsToUnassign.length
      } else {
        this.unassignSummaryRowTarget.classList.add('hidden')
        this.unassignSummaryRowTarget.classList.remove('flex')
      }
    } else {
      this.changesSummaryTarget.classList.add('hidden')
    }

    // Botones
    this.btnCancelTarget.disabled = !this.#hasByRoleChanges
    this.btnSaveTarget.disabled = !this.#hasByRoleChanges
  }

  #showDragDropPanel() {
    this.dragDropPanelTarget.classList.remove('hidden')
    this.emptyRoleStateTarget.classList.add('hidden')
  }

  #showEmptyRoleState() {
    this.dragDropPanelTarget.classList.add('hidden')
    this.emptyRoleStateTarget.classList.remove('hidden')
    this.changesBadgeTarget.classList.add('hidden')
    this.changesBadgeTarget.classList.remove('flex')
  }

  #clearPermLists() {
    this.#assignedPerms = []
    this.#unassignedPerms = []
    this.#initialAssignedIds.clear()
    this.#currentAssignedIds.clear()
    this.#permIdsToAssign = []
    this.#permIdsToUnassign = []
    this.#hasByRoleChanges = false
  }

  #resetByRoleState() {
    this.#rolesList = []
    this.#allPermsList = []
    this.#idRol = null
    this.#clearPermLists()
    this.roleSelectTarget.innerHTML = '<option value="">— Seleccione —</option>'
    this.#showEmptyRoleState()
  }

  // ----------------------------------------------------------------
  // GLOBAL: Carga de datos
  // ----------------------------------------------------------------
  async #loadGlobalData() {
    this.#showOverlay('Cargando datos iniciales...')

    try {
      const [usersRes, globalPermsRes] = await Promise.all([
        this.#apiFetch('/api/User/accessible?activeOnly=true'),
        this.#apiFetch('/api/Permission/global-permissions')
      ])

      if (usersRes.Data) {
        this.#usersList = usersRes.Data.filter(u => u.Active)
      } else {
        showToast(usersRes.Message || 'No se pudieron cargar los usuarios', 'warning')
      }

      if (globalPermsRes.Data && globalPermsRes.Data.length) {
        this.#allGlobalPermsList = globalPermsRes.Data
      } else {
        showToast(globalPermsRes.Message || 'No se pudieron cargar los permisos', 'warning')
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar datos', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  async #loadGlobalUserPermissions(userId) {
    if (!userId) {
      this.#clearGlobalAssignments()
      return
    }

    this.#selectedUserId = userId
    this.#clearGlobalPermLists()

    if (this.#allGlobalPermsList.length === 0) {
      showToast('No hay permisos globales disponibles.', 'warning')
      return
    }

    this.#showOverlay('Cargando permisos del usuario...')

    try {
      const res = await this.#apiFetch(`/api/User/global-permissions?userId=${encodeURIComponent(userId)}`)
      const userPermsSet = new Set(
        res.Data && Array.isArray(res.Data) ? res.Data.map(p => p.Id) : []
      )

      this.#allGlobalPermsList.forEach(perm => {
        const copy = { ...perm }
        if (userPermsSet.has(perm.Id)) {
          this.#assignedGlobalPerms.push(copy)
          this.#initialAssignedGlobalIds.add(perm.Id)
          this.#currentAssignedGlobalIds.add(perm.Id)
        } else {
          this.#unassignedGlobalPerms.push(copy)
        }
      })

      this.#renderGlobalPermLists()
      this.#showGlobalDragDropPanel()
    } catch (err) {
      showToast(err.message || 'Error al cargar permisos del usuario', 'error')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // GLOBAL: Autocomplete
  // ----------------------------------------------------------------
  onUserInput(event) {
    const value = event.target.value.toLowerCase().trim()
    const filtered = value
      ? this.#usersList.filter(u => u.Email.toLowerCase().includes(value))
      : this.#usersList

    this.#renderUserDropdown(filtered)
    this.userDropdownTarget.classList.remove('hidden')

    // Si input vacío → limpiar selección
    if (!value) {
      this.#clearGlobalAssignments()
    }
  }

  onUserFocus() {
    const value = (this.userSearchTarget.value || '').toLowerCase().trim()
    const filtered = value
      ? this.#usersList.filter(u => u.Email.toLowerCase().includes(value))
      : this.#usersList
    this.#renderUserDropdown(filtered)
    this.userDropdownTarget.classList.remove('hidden')
  }

  onUserBlur() {
    // Delay para permitir click en opción
    setTimeout(() => {
      this.userDropdownTarget.classList.add('hidden')
    }, 200)
  }

  #renderUserDropdown(users) {
    const dropdown = this.userDropdownTarget
    dropdown.innerHTML = ''

    if (users.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'px-4 py-2 text-xs text-gray-400'
      empty.textContent = 'Sin resultados'
      dropdown.appendChild(empty)
      return
    }

    users.forEach(user => {
      const opt = document.createElement('div')
      opt.className = 'px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer'
      opt.textContent = user.Email
      opt.dataset.testid = `user-option-${user.Id}`

      opt.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.userSearchTarget.value = user.Email
        this.userDropdownTarget.classList.add('hidden')
        this.#loadGlobalUserPermissions(user.Id)
      })

      dropdown.appendChild(opt)
    })
  }

  // ----------------------------------------------------------------
  // GLOBAL: Eventos
  // ----------------------------------------------------------------
  assignAllGlobal() {
    this.#unassignedGlobalPerms.forEach(p => {
      this.#assignedGlobalPerms.push(p)
      this.#currentAssignedGlobalIds.add(p.Id)
    })
    this.#unassignedGlobalPerms = []
    this.#calculateGlobalChanges()
    this.#renderGlobalPermLists()
  }

  unassignAllGlobal() {
    this.#assignedGlobalPerms.forEach(p => {
      this.#unassignedGlobalPerms.push(p)
      this.#currentAssignedGlobalIds.delete(p.Id)
    })
    this.#assignedGlobalPerms = []
    this.#calculateGlobalChanges()
    this.#renderGlobalPermLists()
  }

  async cancelChangesGlobal() {
    if (this.#selectedUserId) {
      await this.#loadGlobalUserPermissions(this.#selectedUserId)
    } else {
      this.#clearGlobalAssignments()
    }
  }

  async applyChangesGlobal() {
    if (!this.#selectedUserId) {
      showToast('Debe seleccionar un usuario', 'warning')
      return
    }
    if (!this.#hasGlobalChanges) {
      showToast('No hay cambios para aplicar', 'info')
      return
    }

    this.#showOverlay('Aplicando cambios...')

    try {
      const requests = []

      if (this.#permIdsToAssignGlobal.length > 0) {
        requests.push(
          this.#apiFetch('/api/Permission/bulk-global-permissions', {
            method: 'POST',
            body: JSON.stringify({
              UserId: this.#selectedUserId,
              PermissionIds: this.#permIdsToAssignGlobal
            })
          })
        )
      }

      if (this.#permIdsToUnassignGlobal.length > 0) {
        requests.push(
          this.#apiFetch('/api/Permission/bulk-global-permissions', {
            method: 'DELETE',
            body: JSON.stringify({
              UserId: this.#selectedUserId,
              PermissionIds: this.#permIdsToUnassignGlobal
            })
          })
        )
      }

      await Promise.all(requests)

      showToast('Permisos globales actualizados exitosamente', 'success')

      // Sincronizar estado inicial (sin reload)
      this.#initialAssignedGlobalIds.clear()
      this.#currentAssignedGlobalIds.forEach(id => this.#initialAssignedGlobalIds.add(id))
      this.#permIdsToAssignGlobal = []
      this.#permIdsToUnassignGlobal = []
      this.#hasGlobalChanges = false
      this.#updateGlobalChangesUI()
    } catch (err) {
      this.#showErrorModal('Error al aplicar cambios', err.message || 'Error desconocido')
    } finally {
      this.#hideOverlay()
    }
  }

  // ----------------------------------------------------------------
  // GLOBAL: Drag & Drop
  // ----------------------------------------------------------------
  onDragOverGlobal(event) {
    event.preventDefault()
    event.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
  }

  onDropGlobal(event) {
    event.preventDefault()
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')

    const targetZone = event.currentTarget.dataset.dropZone
    if (!this.#draggedGlobalPermId || this.#draggedFromGlobalZone === targetZone) return

    const permId = this.#draggedGlobalPermId

    if (targetZone === 'assigned-global') {
      const idx = this.#unassignedGlobalPerms.findIndex(p => p.Id === permId)
      if (idx !== -1) {
        const [perm] = this.#unassignedGlobalPerms.splice(idx, 1)
        this.#assignedGlobalPerms.push(perm)
        this.#currentAssignedGlobalIds.add(permId)
      }
    } else {
      const idx = this.#assignedGlobalPerms.findIndex(p => p.Id === permId)
      if (idx !== -1) {
        const [perm] = this.#assignedGlobalPerms.splice(idx, 1)
        this.#unassignedGlobalPerms.push(perm)
        this.#currentAssignedGlobalIds.delete(permId)
      }
    }

    this.#calculateGlobalChanges()
    this.#renderGlobalPermLists()
    this.#draggedGlobalPermId = null
    this.#draggedFromGlobalZone = null
  }

  // ----------------------------------------------------------------
  // GLOBAL: Render
  // ----------------------------------------------------------------
  #renderGlobalPermLists() {
    this.#renderGlobalList(
      this.unassignedListGlobalTarget,
      this.emptyUnassignedGlobalTarget,
      this.#unassignedGlobalPerms,
      'unassigned-global',
      false
    )
    this.#renderGlobalList(
      this.assignedListGlobalTarget,
      this.emptyAssignedGlobalTarget,
      this.#assignedGlobalPerms,
      'assigned-global',
      true
    )
    this.#updateCounts(
      this.unassignedCountGlobalTarget,
      this.assignedCountGlobalTarget,
      this.#unassignedGlobalPerms.length,
      this.#assignedGlobalPerms.length
    )
    this.#updateBulkButtons(
      this.btnAssignAllGlobalTarget,
      this.btnUnassignAllGlobalTarget,
      this.#unassignedGlobalPerms.length,
      this.#assignedGlobalPerms.length
    )
    this.#updateGlobalChangesUI()
  }

  #renderGlobalList(container, emptyEl, perms, zone, isAssigned) {
    const existingItems = container.querySelectorAll('[data-perm-item]')
    existingItems.forEach(el => el.remove())

    if (perms.length === 0) {
      emptyEl.classList.remove('hidden')
      emptyEl.classList.add('flex')
    } else {
      emptyEl.classList.add('hidden')
      emptyEl.classList.remove('flex')

      perms.forEach(perm => {
        const item = this.#createGlobalPermItem(perm, zone, isAssigned)
        container.appendChild(item)
      })
    }
  }

  #createGlobalPermItem(perm, zone, isAssigned) {
    const div = document.createElement('div')
    div.dataset.permItem = true
    div.dataset.permId = perm.Id
    div.dataset.testid = `perm-item-${perm.Id}`
    div.draggable = true
    div.className = `flex items-center gap-3 p-3 mb-2 bg-white border rounded-lg cursor-move
      transition-all hover:shadow-md hover:-translate-y-0.5
      ${isAssigned ? 'border-l-4 border-l-green-400 border-gray-200' : 'border-gray-200'}`

    div.innerHTML = `
      <div class="text-gray-400 cursor-grab">
        <span class="material-icons text-xl">drag_indicator</span>
      </div>
      <div class="flex flex-col flex-1 gap-0.5">
        <span data-testid="perm-name" class="font-medium text-gray-800 text-sm">${this.#escapeHtml(perm.Description)}</span>
        <span data-testid="perm-id" class="text-xs text-gray-400">#${perm.Id}</span>
      </div>
    `

    div.addEventListener('dragstart', () => {
      this.#draggedGlobalPermId = perm.Id
      this.#draggedFromGlobalZone = zone
      div.classList.add('opacity-50')
    })
    div.addEventListener('dragend', () => {
      div.classList.remove('opacity-50')
    })

    return div
  }

  #calculateGlobalChanges() {
    this.#permIdsToAssignGlobal = []
    this.#permIdsToUnassignGlobal = []

    this.#currentAssignedGlobalIds.forEach(id => {
      if (!this.#initialAssignedGlobalIds.has(id)) this.#permIdsToAssignGlobal.push(id)
    })
    this.#initialAssignedGlobalIds.forEach(id => {
      if (!this.#currentAssignedGlobalIds.has(id)) this.#permIdsToUnassignGlobal.push(id)
    })

    this.#hasGlobalChanges = this.#permIdsToAssignGlobal.length > 0 || this.#permIdsToUnassignGlobal.length > 0
  }

  #updateGlobalChangesUI() {
    const total = this.#permIdsToAssignGlobal.length + this.#permIdsToUnassignGlobal.length

    if (this.#selectedUserId) {
      this.changesBadgeGlobalTarget.classList.remove('hidden')
      this.changesBadgeGlobalTarget.classList.add('flex')
      this.changesBadgeValueGlobalTarget.textContent = total
      this.changesBadgeValueGlobalTarget.classList.toggle('text-orange-500', this.#hasGlobalChanges)
      this.changesBadgeValueGlobalTarget.classList.toggle('text-gray-400', !this.#hasGlobalChanges)
    }

    if (this.#hasGlobalChanges) {
      this.changesSummaryGlobalTarget.classList.remove('hidden')

      if (this.#permIdsToAssignGlobal.length > 0) {
        this.assignSummaryRowGlobalTarget.classList.remove('hidden')
        this.assignSummaryRowGlobalTarget.classList.add('flex')
        this.assignCountGlobalTarget.textContent = this.#permIdsToAssignGlobal.length
      } else {
        this.assignSummaryRowGlobalTarget.classList.add('hidden')
        this.assignSummaryRowGlobalTarget.classList.remove('flex')
      }

      if (this.#permIdsToUnassignGlobal.length > 0) {
        this.unassignSummaryRowGlobalTarget.classList.remove('hidden')
        this.unassignSummaryRowGlobalTarget.classList.add('flex')
        this.unassignCountGlobalTarget.textContent = this.#permIdsToUnassignGlobal.length
      } else {
        this.unassignSummaryRowGlobalTarget.classList.add('hidden')
        this.unassignSummaryRowGlobalTarget.classList.remove('flex')
      }
    } else {
      this.changesSummaryGlobalTarget.classList.add('hidden')
    }

    this.btnCancelGlobalTarget.disabled = !this.#hasGlobalChanges
    this.btnApplyTarget.disabled = !this.#hasGlobalChanges
  }

  #showGlobalDragDropPanel() {
    this.dragDropPanelGlobalTarget.classList.remove('hidden')
    this.emptyUserStateTarget.classList.add('hidden')
  }

  #clearGlobalPermLists() {
    this.#assignedGlobalPerms = []
    this.#unassignedGlobalPerms = []
    this.#initialAssignedGlobalIds.clear()
    this.#currentAssignedGlobalIds.clear()
    this.#permIdsToAssignGlobal = []
    this.#permIdsToUnassignGlobal = []
    this.#hasGlobalChanges = false
  }

  #clearGlobalAssignments() {
    this.#clearGlobalPermLists()
    this.#selectedUserId = null
    this.dragDropPanelGlobalTarget.classList.add('hidden')
    this.emptyUserStateTarget.classList.remove('hidden')
    this.changesBadgeGlobalTarget.classList.add('hidden')
    this.changesBadgeGlobalTarget.classList.remove('flex')
  }

  #resetGlobalState() {
    this.#usersList = []
    this.#allGlobalPermsList = []
    this.userSearchTarget.value = ''
    this.#clearGlobalAssignments()
  }

  // ----------------------------------------------------------------
  // Helpers: API
  // ----------------------------------------------------------------
  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {}
    const token = session.access_token

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `HTTP ${response.status}`)
    }

    const contentType = response.headers.get("content-type") || ""
    const contentLength = response.headers.get("content-length")
    if (contentLength === "0" || (!contentType.includes("json") && !contentType.includes("text"))) return {}
    const text = await response.text()
    if (!text || !text.trim()) return {}
    return JSON.parse(text)
  }

  // ----------------------------------------------------------------
  // Helpers: Overlay y Toast
  // ----------------------------------------------------------------
  #showOverlay(message) { showLoading(message) }
  #hideOverlay()        { hideLoading() }

  #escapeHtml(str) {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode(str || ''))
    return div.innerHTML
  }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title
    this.errorSubtitleTarget.textContent = subtitle
    this.errorModalTarget.classList.remove('hidden')
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden')
  }
}
