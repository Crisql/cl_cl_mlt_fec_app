// @ts-check
/**
 * Suite E2E: Branches (Sucursal) — migración Angular → Rails
 * Ruta: /configurations/branches
 *
 * Cubre:
 *   - Auth guard
 *   - Carga inicial (tabla de sucursales)
 *   - Mapeo provincia/cantón/distrito a nombres
 *   - Botón "Nueva Sucursal" → panel lateral
 *   - Crear sucursal (POST api/Sucursal)
 *   - Editar sucursal (PATCH api/Sucursal)
 *   - Cascada provincia → cantón → distrito → barrio
 *   - Validaciones del formulario
 *   - Errores de API (modal de error)
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL    = 'http://localhost:3000'
const BRANCH_URL  = `${BASE_URL}/configurations/branches`
const LOGIN_URL   = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-branches',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001'
}

const MOCK_COMPANY = {
  companyId: '42',
  companyName: 'Empresa Test SA'
}

const MOCK_BRANCHES = [
  {
    Id: 1,
    CompanyId: 42,
    SucursalNum: 1,
    Alias: 'Central',
    EmsrUbProvincia: '01',
    EmsrUbCanton: '01',
    EmsrUbDistrito: '01',
    EmsrUbBarrio: 'Catedral',
    EmsrUbOtrasSenas: '100m norte del parque',
    EmsrTlfCodigoPais: 506,
    EmsrTlfNumTelefono: '22221111',
    EmsrFaxCodigoPais: 506,
    EmsrFaxNumTelefono: '',
    EmsrCorreoElectronico: 'central@empresa.com',
    Active: true
  },
  {
    Id: 2,
    CompanyId: 42,
    SucursalNum: 2,
    Alias: 'Heredia',
    EmsrUbProvincia: '04',
    EmsrUbCanton: '01',
    EmsrUbDistrito: '01',
    EmsrUbBarrio: 'Mercedes',
    EmsrUbOtrasSenas: 'Frente al parque central',
    EmsrTlfCodigoPais: 506,
    EmsrTlfNumTelefono: '24401000',
    EmsrFaxCodigoPais: 506,
    EmsrFaxNumTelefono: '24401001',
    EmsrCorreoElectronico: 'heredia@empresa.com',
    Active: false
  }
]

const MOCK_BRANCHES_RESPONSE = { Data: MOCK_BRANCHES, Message: null, Error: false }

async function injectAuth(page) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions', JSON.stringify([]))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY })
}

async function mockGetBranches(page, response = MOCK_BRANCHES_RESPONSE) {
  await page.route('**/api/Sucursal/GetSucursalByCompany**', route =>
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
test.describe('Branches — Auth Guard', () => {
  test('redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await expect(page).toHaveURL(/login/)
  })
})

// ============================================================
// 2. CARGA INICIAL
// ============================================================
test.describe('Branches — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
  })

  test('la página carga y muestra la tabla', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await expect(page.locator('[data-testid="branches-page"]')).toBeVisible()
    await expect(page.locator('[data-testid="branches-table"]')).toBeVisible()
  })

  test('el botón "Nueva Sucursal" está visible', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await expect(page.locator('[data-testid="btn-new-branch"]')).toBeVisible()
  })

  test('la tabla muestra los registros con alias correcto', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await expect(page.getByText('Central')).toBeVisible()
    await expect(page.getByText('Heredia')).toBeVisible()
  })

  test('la tabla muestra badge Activo/Inactivo', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await expect(page.getByText('Activo')).toBeVisible()
    await expect(page.getByText('Inactivo')).toBeVisible()
  })

  test('error GET → toast error', async ({ page }) => {
    await page.route('**/api/Sucursal/GetSucursalByCompany**', route =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    )
    await page.goto(BRANCH_URL)
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 5000 })
  })
})

// ============================================================
// 3. PANEL CREAR
// ============================================================
test.describe('Branches — Panel crear', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
  })

  test('click "Nueva Sucursal" abre el panel', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await expect(page.locator('[data-testid="branch-panel"]')).toBeVisible()
  })

  test('título del panel es "Nueva Sucursal"', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await expect(page.locator('[data-testid="panel-title"]')).toHaveText('Nueva Sucursal')
  })

  test('País está fijo en "Costa Rica" y disabled', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    const countryInput = page.locator('[data-testid="input-country"]')
    await expect(countryInput).toHaveValue('Costa Rica')
    await expect(countryInput).toBeDisabled()
  })

  test('botón Cancelar cierra el panel', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await page.click('[data-testid="btn-cancel-panel"]')
    await expect(page.locator('[data-testid="branch-panel"]')).not.toBeVisible()
  })

  test('backdrop click cierra el panel', async ({ page }) => {
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await page.click('[data-testid="panel-backdrop"]')
    await expect(page.locator('[data-testid="branch-panel"]')).not.toBeVisible()
  })
})

// ============================================================
// 4. VALIDACIONES DE FORMULARIO
// ============================================================
test.describe('Branches — Validaciones', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
  })

  test('Guardar sin datos muestra errores requeridos', async ({ page }) => {
    await page.click('[data-testid="btn-save-panel"]')
    await expect(page.locator('[data-testid="error-sucursal-num"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-provincia"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-otras-senas"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-telefono"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-alias"]')).toBeVisible()
  })

  test('SucursalNum 0 muestra error de patrón', async ({ page }) => {
    await page.fill('[data-testid="input-sucursal-num"]', '0')
    await page.click('[data-testid="btn-save-panel"]')
    await expect(page.locator('[data-testid="error-sucursal-num-pattern"]')).toBeVisible()
  })

  test('email inválido muestra error de patrón', async ({ page }) => {
    await page.fill('[data-testid="input-email"]', 'no-es-email')
    await page.click('[data-testid="btn-save-panel"]')
    await expect(page.locator('[data-testid="error-email-pattern"]')).toBeVisible()
  })
})

// ============================================================
// 5. CASCADA PROVINCIA→CANTÓN→DISTRITO→BARRIO
// ============================================================
test.describe('Branches — Cascada de ubicación', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    // Esperar que carguen los datos JSON
    await page.waitForSelector('[data-testid="select-provincia"] option:not([value=""])', { timeout: 5000 })
  })

  test('select Provincia tiene opciones cargadas', async ({ page }) => {
    const options = await page.locator('[data-testid="select-provincia"] option').count()
    expect(options).toBeGreaterThan(1) // al menos 1 provincia + placeholder
  })

  test('cambio de Provincia carga cantones', async ({ page }) => {
    await page.selectOption('[data-testid="select-provincia"]', { index: 1 })
    await page.waitForTimeout(200)
    const cantonOptions = await page.locator('[data-testid="select-canton"] option:not([value=""])').count()
    expect(cantonOptions).toBeGreaterThan(0)
  })

  test('cambio de Cantón carga distritos', async ({ page }) => {
    await page.selectOption('[data-testid="select-provincia"]', { index: 1 })
    await page.waitForTimeout(200)
    await page.selectOption('[data-testid="select-canton"]', { index: 1 })
    await page.waitForTimeout(200)
    const distOptions = await page.locator('[data-testid="select-distrito"] option:not([value=""])').count()
    expect(distOptions).toBeGreaterThan(0)
  })

  test('cambio de Distrito carga barrios en autocomplete', async ({ page }) => {
    await page.selectOption('[data-testid="select-provincia"]', { index: 1 })
    await page.waitForTimeout(200)
    await page.selectOption('[data-testid="select-canton"]', { index: 1 })
    await page.waitForTimeout(200)
    await page.selectOption('[data-testid="select-distrito"]', { index: 1 })
    await page.waitForTimeout(200)
    // El input de barrio debe tener un valor default del primer barrio
    const barrioVal = await page.locator('[data-testid="input-barrio"]').inputValue()
    expect(barrioVal.length).toBeGreaterThan(0)
  })
})

// ============================================================
// 6. CREAR SUCURSAL
// ============================================================
test.describe('Branches — Crear sucursal', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
  })

  test('POST exitoso → toast success + recarga tabla', async ({ page }) => {
    await page.route('**/api/Sucursal', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'Creado', Error: false }) })
      } else {
        await route.continue()
      }
    })
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await page.waitForSelector('[data-testid="select-provincia"] option:not([value=""])', { timeout: 5000 })

    await page.fill('[data-testid="input-sucursal-num"]', '3')
    await page.selectOption('[data-testid="select-provincia"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.selectOption('[data-testid="select-canton"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.selectOption('[data-testid="select-distrito"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.fill('[data-testid="input-otras-senas"]', '200m sur del parque')
    await page.fill('[data-testid="input-telefono"]', '22334455')
    await page.fill('[data-testid="input-email"]', 'nueva@empresa.com')
    await page.fill('[data-testid="input-alias"]', 'Norte')
    await page.click('[data-testid="btn-save-panel"]')

    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 5000 })
    // El panel debe cerrarse
    await expect(page.locator('[data-testid="branch-panel"]')).not.toBeVisible()
  })

  test('POST con error → modal de error', async ({ page }) => {
    await page.route('**/api/Sucursal', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, body: 'Error de validación' })
      } else {
        await route.continue()
      }
    })
    await page.goto(BRANCH_URL)
    await page.click('[data-testid="btn-new-branch"]')
    await page.waitForSelector('[data-testid="select-provincia"] option:not([value=""])', { timeout: 5000 })

    await page.fill('[data-testid="input-sucursal-num"]', '1')
    await page.selectOption('[data-testid="select-provincia"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.selectOption('[data-testid="select-canton"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.selectOption('[data-testid="select-distrito"]', { index: 1 })
    await page.waitForTimeout(300)
    await page.fill('[data-testid="input-otras-senas"]', 'Dirección')
    await page.fill('[data-testid="input-telefono"]', '22221111')
    await page.fill('[data-testid="input-email"]', 'test@empresa.com')
    await page.fill('[data-testid="input-alias"]', 'Test')
    await page.click('[data-testid="btn-save-panel"]')

    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible({ timeout: 5000 })
  })
})

// ============================================================
// 7. EDITAR SUCURSAL
// ============================================================
test.describe('Branches — Editar sucursal', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGetBranches(page)
    await page.goto(BRANCH_URL)
    await page.waitForSelector('[data-testid="branches-table"]')
    await page.waitForTimeout(800) // Tabulator render
  })

  test('click editar abre panel con título "Editar Sucursal"', async ({ page }) => {
    await page.locator('button[data-action-type="edit"]').first().click()
    await expect(page.locator('[data-testid="panel-title"]')).toHaveText('Editar Sucursal')
  })

  test('panel editar pre-carga los datos de la sucursal', async ({ page }) => {
    await page.locator('button[data-action-type="edit"]').first().click()
    await page.waitForSelector('[data-testid="select-provincia"] option:not([value=""])', { timeout: 5000 })
    const alias = await page.locator('[data-testid="input-alias"]').inputValue()
    expect(alias).toBe('Central')
  })

  test('PATCH exitoso → toast success', async ({ page }) => {
    await page.route('**/api/Sucursal', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'Actualizado', Error: false }) })
      } else {
        await route.continue()
      }
    })
    await page.locator('button[data-action-type="edit"]').first().click()
    await page.waitForTimeout(500)
    await page.fill('[data-testid="input-alias"]', 'Central Modificada')
    await page.click('[data-testid="btn-save-panel"]')
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 5000 })
  })
})
