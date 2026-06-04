// @ts-check
/**
 * Suite E2E: Roles — migración Angular → Rails
 * Ruta: /configurations/roles
 *
 * Cubre:
 *   - Auth guard
 *   - Carga inicial (tabla de roles)
 *   - Botón "Nuevo" → modal crear
 *   - Crear rol (POST api/Rol)
 *   - Editar rol (PATCH api/Rol)
 *   - Rol OWNER no editable (toast info)
 *   - Validaciones del formulario
 *   - Estados de error de API
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL  = 'http://localhost:3000'
const ROLES_URL = `${BASE_URL}/configurations/roles`
const LOGIN_URL = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-roles',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001'
}

const MOCK_COMPANY = {
  companyId: '42',
  companyName: 'Empresa Test SA'
}

const MOCK_ROLES = [
  { Id: 1, Name: 'OWNER',   Active: true,  GroupId: 0 },
  { Id: 2, Name: 'Admin',   Active: true,  GroupId: 0 },
  { Id: 3, Name: 'Ventas',  Active: false, GroupId: 0 },
]

const MOCK_ROLES_RESPONSE = {
  Data: MOCK_ROLES,
  Message: null,
  Error: false
}

async function injectAuth(page) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY })
}

async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

async function mockGetRoles(page, response = MOCK_ROLES_RESPONSE) {
  await page.route('**/api/Rol/GetRoles**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  )
}

// ============================================================
// 1. AUTH GUARD
// ============================================================
test.describe('Roles — Auth Guard', () => {
  test('redirige a /login si no hay sesion', async ({ page }) => {
    await page.goto(LOGIN_URL)
    await clearAuth(page)
    await page.goto(ROLES_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('redirige a /login si sesion expirada', async ({ page }) => {
    await page.goto(LOGIN_URL)
    const expired = { ...MOCK_SESSION, expires_at: Date.now() - 1000 }
    await page.evaluate((s) => localStorage.setItem('Session', JSON.stringify(s)), expired)
    await page.goto(ROLES_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('permite acceso con sesion valida', async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
    await expect(page).toHaveURL(new RegExp('/configurations/roles'))
    await expect(page.locator('[data-testid="roles-page"]')).toBeVisible()
  })
})

// ============================================================
// 2. CARGA INICIAL
// ============================================================
test.describe('Roles — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
  })

  test('muestra boton Nuevo', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-new-role"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-new-role"]')).toContainText('Nuevo')
  })

  test('tabla muestra columna Nombre del Rol', async ({ page }) => {
    await expect(page.locator('[data-testid="roles-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="roles-table"]')).toContainText('Nombre del Rol')
  })

  test('tabla muestra columna Activo?', async ({ page }) => {
    await expect(page.locator('[data-testid="roles-table"]')).toContainText('Activo?')
  })

  test('tabla muestra los roles cargados', async ({ page }) => {
    const table = page.locator('[data-testid="roles-table"]')
    await expect(table).toContainText('OWNER')
    await expect(table).toContainText('Admin')
    await expect(table).toContainText('Ventas')
  })

  test('tabla muestra icono activo para roles activos', async ({ page }) => {
    // Roles activos deben tener icono/texto activo
    const rows = page.locator('[data-testid^="role-row-"]')
    await expect(rows).toHaveCount(3)
  })

  test('icono inactivo para rol Ventas (Active=false)', async ({ page }) => {
    const ventasRow = page.locator('[data-testid="role-row-3"]')
    await expect(ventasRow).toContainText('Inactivo')
  })

  test('icono activo para rol Admin (Active=true)', async ({ page }) => {
    const adminRow = page.locator('[data-testid="role-row-2"]')
    await expect(adminRow).toContainText('Activo')
  })

  test('columnas Id, GroupId, Active NO son visibles en encabezados', async ({ page }) => {
    const headers = page.locator('[data-testid="roles-table"] th')
    await expect(headers.filter({ hasText: /^Id$/ })).toHaveCount(0)
    await expect(headers.filter({ hasText: /^GroupId$/ })).toHaveCount(0)
    await expect(headers.filter({ hasText: /^Active$/ })).toHaveCount(0)
  })

  test('llama a GetRoles con el companyId del storage', async ({ page }) => {
    let capturedUrl = ''
    await page.route('**/api/Rol/GetRoles**', route => {
      capturedUrl = route.request().url()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ROLES_RESPONSE)
      })
    })
    await page.reload()
    await page.waitForTimeout(500)
    expect(capturedUrl).toContain('companyId=42')
  })
})

// ============================================================
// 3. BOTÓN NUEVO → CREAR ROL
// ============================================================
test.describe('Roles — Crear rol', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
  })

  test('click Nuevo abre modal de crear', async ({ page }) => {
    await page.click('[data-testid="btn-new-role"]')
    await expect(page.locator('[data-testid="role-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="role-modal-title"]')).toContainText('Rol')
  })

  test('modal tiene campo Nombre del Rol', async ({ page }) => {
    await page.click('[data-testid="btn-new-role"]')
    await expect(page.locator('[data-testid="role-name-input"]')).toBeVisible()
  })

  test('boton Crear deshabilitado con campo vacio', async ({ page }) => {
    await page.click('[data-testid="btn-new-role"]')
    await expect(page.locator('[data-testid="btn-submit-role"]')).toBeDisabled()
  })

  test('boton Crear habilitado con nombre valido', async ({ page }) => {
    await page.click('[data-testid="btn-new-role"]')
    await page.fill('[data-testid="role-name-input"]', 'Soporte')
    await expect(page.locator('[data-testid="btn-submit-role"]')).toBeEnabled()
  })

  test('boton Cancelar cierra el modal', async ({ page }) => {
    await page.click('[data-testid="btn-new-role"]')
    await page.click('[data-testid="btn-cancel-role"]')
    await expect(page.locator('[data-testid="role-modal"]')).not.toBeVisible()
  })

  test('submit envía POST a api/Rol con payload correcto', async ({ page }) => {
    let capturedPayload = null
    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'POST') {
        capturedPayload = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Data: { Id: 10, Name: 'Soporte', Active: true, GroupId: 0 }, Error: false })
        })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-new-role"]')
    await page.fill('[data-testid="role-name-input"]', 'Soporte')
    await page.click('[data-testid="btn-submit-role"]')
    await page.waitForTimeout(300)

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.role.Id).toBe(0)
    expect(capturedPayload.role.Name).toBe('Soporte')
    expect(capturedPayload.role.Active).toBe(true)
    expect(capturedPayload.role.GroupId).toBe(0)
    expect(capturedPayload.companyId).toBe(42)
  })

  test('tras crear exitosamente cierra modal y recarga tabla', async ({ page }) => {
    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Data: { Id: 10, Name: 'Soporte', Active: true, GroupId: 0 }, Error: false })
        })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-new-role"]')
    await page.fill('[data-testid="role-name-input"]', 'Soporte')
    await page.click('[data-testid="btn-submit-role"]')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="role-modal"]')).not.toBeVisible()
  })

  test('muestra toast de exito al crear rol', async ({ page }) => {
    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Data: { Id: 10, Name: 'Soporte', Active: true, GroupId: 0 }, Error: false })
        })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-new-role"]')
    await page.fill('[data-testid="role-name-input"]', 'Soporte')
    await page.click('[data-testid="btn-submit-role"]')
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="toast"]')).toContainText('correctamente')
  })
})

// ============================================================
// 4. EDITAR ROL
// ============================================================
test.describe('Roles — Editar rol', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
  })

  test('click editar en fila Admin abre modal con nombre prellenado', async ({ page }) => {
    await page.click('[data-testid="btn-edit-role-2"]')
    await expect(page.locator('[data-testid="role-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="role-name-input"]')).toHaveValue('Admin')
  })

  test('modal en modo editar muestra boton Modificar', async ({ page }) => {
    await page.click('[data-testid="btn-edit-role-2"]')
    await expect(page.locator('[data-testid="btn-submit-role"]')).toContainText('Modificar')
  })

  test('submit editar envía PATCH a api/Rol con payload correcto', async ({ page }) => {
    let capturedPayload = null
    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'PATCH') {
        capturedPayload = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Data: { Id: 2, Name: 'Admin Modificado', Active: true, GroupId: 0 }, Error: false })
        })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-edit-role-2"]')
    await page.fill('[data-testid="role-name-input"]', 'Admin Modificado')
    await page.click('[data-testid="btn-submit-role"]')
    await page.waitForTimeout(300)

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.role.Id).toBe(2)
    expect(capturedPayload.role.Name).toBe('Admin Modificado')
    expect(capturedPayload.companyId).toBe(42)
  })

  test('muestra toast de exito al editar rol', async ({ page }) => {
    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Data: { Id: 2, Name: 'Admin Updated', Active: true, GroupId: 0 }, Error: false })
        })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-edit-role-2"]')
    await page.fill('[data-testid="role-name-input"]', 'Admin Updated')
    await page.click('[data-testid="btn-submit-role"]')
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="toast"]')).toContainText('correctamente')
  })
})

// ============================================================
// 5. ROL OWNER — NO EDITABLE
// ============================================================
test.describe('Roles — Rol OWNER protegido', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
  })

  test('click editar en OWNER muestra toast INFO (no abre modal)', async ({ page }) => {
    await page.click('[data-testid="btn-edit-role-1"]')
    // Modal NO debe abrirse
    await expect(page.locator('[data-testid="role-modal"]')).not.toBeVisible()
    // Toast de info debe aparecer
    await expect(page.locator('[data-testid="toast"]')).toBeVisible({ timeout: 2000 })
    await expect(page.locator('[data-testid="toast"]')).toContainText('no permite su edición')
  })
})

// ============================================================
// 6. VALIDACIONES DEL FORMULARIO
// ============================================================
test.describe('Roles — Validaciones', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetRoles(page)
    await page.goto(ROLES_URL)
    await page.click('[data-testid="btn-new-role"]')
  })

  test('campo Nombre es requerido — muestra error si se deja vacío', async ({ page }) => {
    await page.fill('[data-testid="role-name-input"]', 'X')
    await page.fill('[data-testid="role-name-input"]', '')
    await page.locator('[data-testid="role-name-input"]').blur()
    await expect(page.locator('[data-testid="role-name-error"]')).toBeVisible()
  })

  test('boton submit deshabilitado con nombre vacío', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-submit-role"]')).toBeDisabled()
  })

  test('boton submit habilitado con nombre válido', async ({ page }) => {
    await page.fill('[data-testid="role-name-input"]', 'Nuevo Rol')
    await expect(page.locator('[data-testid="btn-submit-role"]')).toBeEnabled()
  })
})

// ============================================================
// 7. ERRORES DE API
// ============================================================
test.describe('Roles — Errores de API', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
  })

  test('error al cargar roles muestra modal de error', async ({ page }) => {
    await page.route('**/api/Rol/GetRoles**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: null, Message: 'Error de servidor', Error: true })
      })
    )
    await page.goto(ROLES_URL)
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible({ timeout: 3000 })
  })

  test('error en POST muestra modal de error', async ({ page }) => {
    await mockGetRoles(page)
    await page.goto(ROLES_URL)

    await page.route('**/api/Rol', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 500, body: 'Internal Server Error' })
      }
      return route.continue()
    })

    await page.click('[data-testid="btn-new-role"]')
    await page.fill('[data-testid="role-name-input"]', 'Test')
    await page.click('[data-testid="btn-submit-role"]')
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible({ timeout: 3000 })
  })
})
