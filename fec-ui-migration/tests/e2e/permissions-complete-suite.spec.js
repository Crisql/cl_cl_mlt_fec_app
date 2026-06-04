// @ts-check
/**
 * Suite E2E: Permissions — migración Angular → Rails
 * Cubre: tabs, permisos por rol (drag&drop, botones, API), permisos globales
 *
 * Storage mapping (ver STORAGE-KEY-MAPPING.md):
 *   localStorage.Session         → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions   → array de strings con nombres de permisos
 */

const { test, expect } = require('@playwright/test')

const BASE_URL  = 'http://localhost:3000'
const PERMS_URL = `${BASE_URL}/configurations/permissions`
const LOGIN_URL = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-123',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001'
}

const MOCK_COMPANY = {
  companyId: '1',
  companyName: 'Empresa Test'
}

// Permissions son strings en sessionStorage (no objetos)
const PERMS_FULL      = ['Configurations_Permissions_Access', 'Configurations_Permissions_GlobalAccess']
const PERMS_BYROLE    = ['Configurations_Permissions_Access']
const PERMS_GLOBAL    = ['Configurations_Permissions_GlobalAccess']
const PERMS_NONE      = []

async function injectAuth(page, perms = PERMS_FULL) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    // Session → localStorage
    localStorage.setItem('Session', JSON.stringify(session))
    // CurrentCompany y Permissions → sessionStorage
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions', JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms })
}

async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// ============================================================
// 1. AUTH GUARD
// ============================================================
test.describe('Permissions — Auth Guard', () => {
  test('redirige a /login si no hay sesion', async ({ page }) => {
    await page.goto(LOGIN_URL)
    await clearAuth(page)
    await page.goto(PERMS_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('redirige a /login si sesion expirada', async ({ page }) => {
    await page.goto(LOGIN_URL)
    const expired = { ...MOCK_SESSION, expires_at: Date.now() - 1000 }
    await page.evaluate((s) => localStorage.setItem('Session', JSON.stringify(s)), expired)
    await page.goto(PERMS_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('permite acceso con sesion valida y permisos', async ({ page }) => {
    await injectAuth(page)
    await page.goto(PERMS_URL)
    await expect(page).toHaveURL(new RegExp('/configurations/permissions'))
    await expect(page.locator('[data-testid="permissions-page"]')).toBeVisible()
  })
})

// ============================================================
// 2. TABS — FILTRADO POR PERMISOS
// ============================================================
test.describe('Permissions — Tabs', () => {
  test('muestra ambos tabs con permisos completos', async ({ page }) => {
    await injectAuth(page, PERMS_FULL)
    await page.goto(PERMS_URL)
    await expect(page.locator('[data-testid="tab-by-role"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-global"]')).toBeVisible()
  })

  test('muestra solo tab by-role sin permiso global', async ({ page }) => {
    await injectAuth(page, PERMS_BYROLE)
    await page.goto(PERMS_URL)
    await expect(page.locator('[data-testid="tab-by-role"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-global"]')).not.toBeVisible()
  })

  test('muestra solo tab global sin permiso by-role', async ({ page }) => {
    await injectAuth(page, PERMS_GLOBAL)
    await page.goto(PERMS_URL)
    await expect(page.locator('[data-testid="tab-by-role"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="tab-global"]')).toBeVisible()
  })

  test('redirige a /home si usuario sin ningun permiso', async ({ page }) => {
    await injectAuth(page, PERMS_NONE)
    await page.goto(PERMS_URL)
    await expect(page).toHaveURL(new RegExp('/home'))
  })

  test('URL refleja tab by-role al navegar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(PERMS_URL)
    await page.locator('[data-testid="tab-by-role"]').click()
    await expect(page).toHaveURL(new RegExp('/configurations/permissions/by-role'))
  })

  test('URL refleja tab global al navegar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(PERMS_URL)
    await page.locator('[data-testid="tab-global"]').click()
    await expect(page).toHaveURL(new RegExp('/configurations/permissions/global'))
  })

  test('URL /by-role activa primer tab', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
    await expect(page.locator('[data-testid="tab-by-role"]')).toHaveAttribute('aria-selected', 'true')
  })

  test('URL /global activa segundo tab', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
    await expect(page.locator('[data-testid="tab-global"]')).toHaveAttribute('aria-selected', 'true')
  })

  test('auto-redirect a primer tab en ruta base', async ({ page }) => {
    await injectAuth(page)
    await page.goto(PERMS_URL)
    await expect(page).toHaveURL(new RegExp('/configurations/permissions/(by-role|global)'))
  })
})

// ============================================================
// 3. TAB BY-ROLE — CARGA INICIAL
// ============================================================
test.describe('Permissions By-Role — Carga inicial', () => {
  test('muestra selector de rol', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
    await expect(page.locator('[data-testid="role-select"]')).toBeVisible()
  })

  test('panel de permisos visible tras cargar roles', async ({ page }) => {
    await page.route('**/api/Rol/GetRoles**', r => r.fulfill({
      json: { Data: [{ Id: 1, Name: 'Admin' }, { Id: 2, Name: 'Vendedor' }], Message: 'ok' }
    }))
    await page.route('**/api/Permission/GetPermissions**', r => r.fulfill({
      json: { Data: [{ Id: 1, Description: 'Ver Facturas', Name: 'Invoice_View' }], Message: 'ok' }
    }))
    await page.route('**/api/Permission/GetPermissionsByRol**', r => r.fulfill({
      json: { Data: [], Message: 'ok' }
    }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
    await expect(page.locator('[data-testid="drag-drop-panel"]')).toBeVisible()
  })

  test('muestra empty state cuando no hay roles', async ({ page }) => {
    await page.route('**/api/Rol/GetRoles**', r => r.fulfill({
      json: { Data: [], Message: 'No hay roles' }
    }))
    await page.route('**/api/Permission/GetPermissions**', r => r.fulfill({
      json: { Data: [], Message: 'ok' }
    }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
    await expect(page.locator('[data-testid="empty-role-state"]')).toBeVisible()
  })
})

// ============================================================
// 4. TAB BY-ROLE — ACCIONES
// ============================================================
test.describe('Permissions By-Role — Acciones', () => {
  const ROLES     = [{ Id: 1, Name: 'Admin' }, { Id: 2, Name: 'Vendedor' }]
  const ALL_PERMS = [
    { Id: 1, Description: 'Ver Facturas',   Name: 'Invoice_View'   },
    { Id: 2, Description: 'Crear Facturas', Name: 'Invoice_Create' }
  ]

  async function setup(page, assignedIds = []) {
    await page.route('**/api/Rol/GetRoles**', r => r.fulfill({ json: { Data: ROLES, Message: 'ok' } }))
    await page.route('**/api/Permission/GetPermissions**', r => r.fulfill({ json: { Data: ALL_PERMS, Message: 'ok' } }))
    await page.route('**/api/Permission/GetPermissionsByRol**', r => r.fulfill({ json: { Data: assignedIds, Message: 'ok' } }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
  }

  test('boton Asignar todos mueve todos a asignados', async ({ page }) => {
    await setup(page, [])
    await page.locator('[data-testid="btn-assign-all"]').click()
    await expect(page.locator('[data-testid="assigned-list"] [data-perm-item]')).toHaveCount(2)
    await expect(page.locator('[data-testid="unassigned-list"] [data-perm-item]')).toHaveCount(0)
  })

  test('boton Desasignar todos mueve todos a disponibles', async ({ page }) => {
    await setup(page, [1, 2])
    await page.locator('[data-testid="btn-unassign-all"]').click()
    await expect(page.locator('[data-testid="unassigned-list"] [data-perm-item]')).toHaveCount(2)
    await expect(page.locator('[data-testid="assigned-list"] [data-perm-item]')).toHaveCount(0)
  })

  test('boton Asignar todos deshabilitado si no hay disponibles', async ({ page }) => {
    await setup(page, [1, 2])
    await expect(page.locator('[data-testid="btn-assign-all"]')).toBeDisabled()
  })

  test('boton Desasignar todos deshabilitado si no hay asignados', async ({ page }) => {
    await setup(page, [])
    await expect(page.locator('[data-testid="btn-unassign-all"]')).toBeDisabled()
  })

  test('badge cambios pendientes aparece al asignar', async ({ page }) => {
    await setup(page, [])
    await page.locator('[data-testid="btn-assign-all"]').click()
    await expect(page.locator('[data-testid="changes-badge"]')).toBeVisible()
    const val = await page.locator('[data-testid="changes-badge-value"]').textContent()
    expect(parseInt(val)).toBeGreaterThan(0)
  })

  test('resumen de cambios visible tras modificar', async ({ page }) => {
    await setup(page, [])
    await page.locator('[data-testid="btn-assign-all"]').click()
    await expect(page.locator('[data-testid="changes-summary"]')).toBeVisible()
    await expect(page.locator('[data-testid="assign-count"]')).toBeVisible()
  })

  test('Cancelar Cambios restaura estado inicial', async ({ page }) => {
    await setup(page, [])
    await page.locator('[data-testid="btn-assign-all"]').click()
    await page.locator('[data-testid="btn-cancel"]').click()
    await expect(page.locator('[data-testid="changes-summary"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="assigned-list"] [data-perm-item]')).toHaveCount(0)
  })

  test('Cancelar Cambios deshabilitado sin cambios', async ({ page }) => {
    await setup(page, [])
    await expect(page.locator('[data-testid="btn-cancel"]')).toBeDisabled()
  })

  test('Guardar Cambios deshabilitado sin cambios', async ({ page }) => {
    await setup(page, [])
    await expect(page.locator('[data-testid="btn-save"]')).toBeDisabled()
  })

  test('Guardar Cambios llama POST AssignPermByRol con estructura correcta', async ({ page }) => {
    let body = null
    await page.route('**/api/Permission/AssignPermByRol', r => {
      body = r.request().postDataJSON()
      r.fulfill({ json: { Data: { Result: true }, Message: 'ok' } })
    })
    await page.route('**/api/Permission/GetPermsByUser**', r => r.fulfill({ json: { Data: [], Message: 'ok' } }))
    await setup(page, [])
    await page.locator('[data-testid="btn-assign-all"]').click()
    await page.locator('[data-testid="btn-save"]').click()
    expect(body).not.toBeNull()
    expect(body).toHaveProperty('idRol')
    expect(body).toHaveProperty('permByRolList')
    expect(Array.isArray(body.permByRolList)).toBe(true)
    expect(body.permByRolList[0]).toMatchObject({ Id: 0, PermId: expect.any(Number), RolId: expect.any(Number), Active: true })
  })

  test('cambio de rol recarga permisos', async ({ page }) => {
    let calls = 0
    await page.route('**/api/Permission/GetPermissionsByRol**', r => { calls++; r.fulfill({ json: { Data: [], Message: 'ok' } }) })
    await setup(page, [])
    await page.locator('[data-testid="role-select"]').selectOption('2')
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  test('perm-item muestra descripcion e ID', async ({ page }) => {
    await setup(page, [1])
    const item = page.locator('[data-testid="assigned-list"] [data-testid="perm-item-1"]')
    await expect(item.locator('[data-testid="perm-name"]')).toContainText('Ver Facturas')
    await expect(item.locator('[data-testid="perm-id"]')).toContainText('#1')
  })

  test('sin cambios no muestra changes-summary', async ({ page }) => {
    await setup(page, [1])
    await expect(page.locator('[data-testid="changes-summary"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="btn-save"]')).toBeDisabled()
  })
})

// ============================================================
// 5. TAB GLOBAL — CARGA INICIAL
// ============================================================
test.describe('Permissions Global — Carga inicial', () => {
  test('muestra input de busqueda de usuario', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
    await expect(page.locator('[data-testid="user-search"]')).toBeVisible()
  })

  test('muestra empty state sin usuario seleccionado', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
    await expect(page.locator('[data-testid="empty-user-state"]')).toBeVisible()
  })

  test('panel de permisos oculto sin usuario', async ({ page }) => {
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
    await expect(page.locator('[data-testid="drag-drop-panel-global"]')).not.toBeVisible()
  })
})

// ============================================================
// 6. TAB GLOBAL — ACCIONES
// ============================================================
test.describe('Permissions Global — Acciones', () => {
  const USERS = [
    { Id: 'u1', Email: 'admin@test.com', Active: true },
    { Id: 'u2', Email: 'user@test.com',  Active: true }
  ]
  const GLOBAL_PERMS = [
    { Id: 10, Description: 'Acceso Global A', Name: 'Global_A' },
    { Id: 11, Description: 'Acceso Global B', Name: 'Global_B' }
  ]

  async function setup(page, userAssigned = []) {
    await page.route('**/api/User/accessible**', r => r.fulfill({ json: { Data: USERS, Message: 'ok' } }))
    await page.route('**/api/Permission/global-permissions', r => r.fulfill({ json: { Data: GLOBAL_PERMS, Message: 'ok' } }))
    await page.route('**/api/User/global-permissions**', r => r.fulfill({ json: { Data: userAssigned, Message: 'ok' } }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
  }

  test('autocomplete filtra usuarios por email', async ({ page }) => {
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await expect(page.locator('[data-testid="user-option-u1"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="user-option-u1"]')).toContainText('admin@test.com')
  })

  test('al seleccionar usuario aparece panel de permisos', async ({ page }) => {
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await expect(page.locator('[data-testid="drag-drop-panel-global"]')).toBeVisible()
  })

  test('permisos se separan correctamente al seleccionar usuario', async ({ page }) => {
    await setup(page, [{ Id: 10, Description: 'Acceso Global A', Name: 'Global_A' }])
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await expect(page.locator('[data-testid="assigned-list-global"] [data-perm-item]')).toHaveCount(1)
    await expect(page.locator('[data-testid="unassigned-list-global"] [data-perm-item]')).toHaveCount(1)
  })

  test('Asignar todos en global funciona', async ({ page }) => {
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-assign-all-global"]').click()
    await expect(page.locator('[data-testid="assigned-list-global"] [data-perm-item]')).toHaveCount(2)
    await expect(page.locator('[data-testid="unassigned-list-global"] [data-perm-item]')).toHaveCount(0)
  })

  test('Desasignar todos en global funciona', async ({ page }) => {
    await setup(page, GLOBAL_PERMS)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-unassign-all-global"]').click()
    await expect(page.locator('[data-testid="unassigned-list-global"] [data-perm-item]')).toHaveCount(2)
    await expect(page.locator('[data-testid="assigned-list-global"] [data-perm-item]')).toHaveCount(0)
  })

  test('Aplicar Cambios llama POST bulk con estructura correcta', async ({ page }) => {
    let postBody = null
    await page.route('**/api/Permission/bulk-global-permissions', async r => {
      if (r.request().method() === 'POST') { postBody = r.request().postDataJSON() }
      r.fulfill({ json: { Data: true, Message: 'ok' } })
    })
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-assign-all-global"]').click()
    await page.locator('[data-testid="btn-apply"]').click()
    expect(postBody).not.toBeNull()
    expect(postBody.UserId).toBe('u1')
    expect(postBody.PermissionIds).toEqual(expect.arrayContaining([10, 11]))
  })

  test('Aplicar Cambios llama DELETE bulk para desasignar', async ({ page }) => {
    let deleteBody = null
    await page.route('**/api/Permission/bulk-global-permissions', async r => {
      if (r.request().method() === 'DELETE') { deleteBody = r.request().postDataJSON() }
      r.fulfill({ json: { Data: true, Message: 'ok' } })
    })
    await setup(page, GLOBAL_PERMS)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-unassign-all-global"]').click()
    await page.locator('[data-testid="btn-apply"]').click()
    expect(deleteBody).not.toBeNull()
    expect(deleteBody.UserId).toBe('u1')
  })

  test('Cancelar Cambios en global restaura estado', async ({ page }) => {
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-assign-all-global"]').click()
    await page.locator('[data-testid="btn-cancel-global"]').click()
    await expect(page.locator('[data-testid="changes-summary-global"]')).not.toBeVisible()
  })

  test('Aplicar Cambios deshabilitado sin cambios', async ({ page }) => {
    await setup(page)
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await expect(page.locator('[data-testid="btn-apply"]')).toBeDisabled()
  })

  test('Aplicar Cambios NO recarga la pagina', async ({ page }) => {
    let loads = 0
    page.on('load', () => loads++)
    await page.route('**/api/Permission/bulk-global-permissions', r => r.fulfill({ json: { Data: true, Message: 'ok' } }))
    await setup(page)
    const before = loads
    await page.locator('[data-testid="user-search"]').fill('admin')
    await page.locator('[data-testid="user-option-u1"]').click()
    await page.locator('[data-testid="btn-assign-all-global"]').click()
    await page.locator('[data-testid="btn-apply"]').click()
    await page.waitForTimeout(500)
    expect(loads).toBe(before)
  })
})

// ============================================================
// 7. EDGE CASES
// ============================================================
test.describe('Permissions — Edge Cases', () => {
  test('by-role: error API en GetRoles muestra toast', async ({ page }) => {
    await page.route('**/api/Rol/GetRoles**', r => r.fulfill({ status: 500 }))
    await page.route('**/api/Permission/GetPermissions**', r => r.fulfill({ json: { Data: [], Message: 'ok' } }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/by-role`)
    await expect(page.locator('[data-testid="toast-container"]')).toBeVisible()
  })

  test('global: error API en accessible muestra toast', async ({ page }) => {
    await page.route('**/api/User/accessible**', r => r.fulfill({ status: 500 }))
    await page.route('**/api/Permission/global-permissions**', r => r.fulfill({ json: { Data: [], Message: 'ok' } }))
    await injectAuth(page)
    await page.goto(`${PERMS_URL}/global`)
    await expect(page.locator('[data-testid="toast-container"]')).toBeVisible()
  })
})
