// @ts-check
/**
 * Suite E2E: Menu + Company Selector — migración Angular → Rails
 */

const { test, expect } = require('@playwright/test')

const BASE_URL   = 'http://localhost:3000'
const HOME_URL   = `${BASE_URL}/home`
const LOGIN_URL  = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-123',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: '999'
}

const MOCK_COMPANY = {
  companyName: 'Empresa Demo',
  companyId: 1,
  codigoActividad: '462001',
  groupId: 1,
  UseFactProv: false,
  SendReceptAndApInv: false
}

const MOCK_PERMISSIONS = ['M_Documents', 'Documents_Issued_ViewDocuments', 'M_Config']

const MOCK_COMPANIES_RESPONSE = {
  Data: [
    { Id: 1, EmsrIdeNumero: '3101000001', EmsrNombreComercial: 'Empresa Demo', CodigoActividad: '462001', GroupId: 1, UseFactProv: false, SendReceptAndApInv: false },
    { Id: 2, EmsrIdeNumero: '3101000002', EmsrNombreComercial: 'Otra Empresa', CodigoActividad: '461001', GroupId: 2, UseFactProv: true, SendReceptAndApInv: true }
  ],
  Message: ''
}

async function injectAuth(page, { company = MOCK_COMPANY, permissions = MOCK_PERMISSIONS } = {}) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, perms }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    if (company) localStorage.setItem('CurrentCompany', JSON.stringify(company))
    if (perms)   localStorage.setItem('Permissions', JSON.stringify(perms))
  }, { session: MOCK_SESSION, company, perms: permissions })
}

// ============================================================
// 1. LAYOUT PROTEGIDO
// ============================================================
test.describe('Layout protegido', () => {
  test('muestra el sidebar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
  })

  test('muestra el toolbar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
  })

  test('muestra el logo en el sidebar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="sidebar-logo"]')).toBeVisible()
  })

  test('muestra el username en el sidebar', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="sidebar-user"]')).toContainText('testuser@clavisco.com')
  })
})

// ============================================================
// 2. MENU — NODOS SIEMPRE VISIBLES
// ============================================================
test.describe('Menu — nodos siempre visibles', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, { permissions: [] })
    await page.goto(HOME_URL)
  })

  test('Inicio siempre visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-item-home"]')).toBeVisible()
  })

  test('Cerrar sesión siempre visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-item-logout"]')).toBeVisible()
  })
})

// ============================================================
// 3. MENU — VISIBILIDAD POR PERMISOS
// ============================================================
test.describe('Menu — visibilidad por permisos', () => {
  test('Documentos visible con M_Documents', async ({ page }) => {
    await injectAuth(page, { permissions: ['M_Documents'] })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="menu-item-documents"]')).toBeVisible()
  })

  test('Documentos oculto sin M_Documents', async ({ page }) => {
    await injectAuth(page, { permissions: [] })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="menu-item-documents"]')).toBeHidden()
  })

  test('Configuración visible con M_Config', async ({ page }) => {
    await injectAuth(page, { permissions: ['M_Config'] })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="menu-item-settings"]')).toBeVisible()
  })

  test('padre visible si hijo tiene permiso aunque padre no lo tenga directo', async ({ page }) => {
    await injectAuth(page, { permissions: ['Documents_Issued_ViewDocuments'] })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="menu-item-documents"]')).toBeVisible()
  })

  test('Logs visible con Logs_Access', async ({ page }) => {
    await injectAuth(page, { permissions: ['Logs_Access'] })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="menu-item-textFilesLogs"]')).toBeVisible()
  })
})

// ============================================================
// 4. MENU — TOGGLE SIDEBAR
// ============================================================
test.describe('Menu — toggle sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
  })

  test('botón toggle existe en toolbar', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-toggle"]')).toBeVisible()
  })

  test('click toggle colapsa el sidebar', async ({ page }) => {
    await page.locator('[data-testid="menu-toggle"]').click()
    await expect(page.locator('[data-testid="sidebar"]')).toHaveAttribute('data-collapsed', 'true')
  })

  test('segundo click expande el sidebar', async ({ page }) => {
    await page.locator('[data-testid="menu-toggle"]').click()
    await page.locator('[data-testid="menu-toggle"]').click()
    await expect(page.locator('[data-testid="sidebar"]')).not.toHaveAttribute('data-collapsed', 'true')
  })
})

// ============================================================
// 5. MENU — SUB-MENÚS COLAPSABLES
// ============================================================
test.describe('Menu — sub-menús', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, { permissions: ['M_Documents', 'Documents_Issued_ViewDocuments'] })
    await page.goto(HOME_URL)
  })

  test('sub-items ocultos por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-item-issued_documents"]')).toBeHidden()
  })

  test('click en padre expande sub-items', async ({ page }) => {
    await page.locator('[data-testid="menu-item-documents"]').click()
    await expect(page.locator('[data-testid="menu-item-issued_documents"]')).toBeVisible()
  })

  test('segundo click colapsa sub-items', async ({ page }) => {
    await page.locator('[data-testid="menu-item-documents"]').click()
    await page.locator('[data-testid="menu-item-documents"]').click()
    await expect(page.locator('[data-testid="menu-item-issued_documents"]')).toBeHidden()
  })
})

// ============================================================
// 6. MENU — LOGOUT
// ============================================================
test.describe('Menu — logout', () => {
  test('click logout limpia sesión y redirige a login', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await page.locator('[data-testid="menu-item-logout"]').click()
    await expect(page).toHaveURL(new RegExp('/login'))
    const session = await page.evaluate(() => localStorage.getItem('Session'))
    expect(session).toBeNull()
  })
})

// ============================================================
// 7. TOOLBAR — EMPRESA
// ============================================================
test.describe('Toolbar — empresa', () => {
  test('muestra el nombre de la empresa seleccionada', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="company-button"]')).toContainText('Empresa Demo')
  })

  test('muestra "No seleccionada" sin empresa', async ({ page }) => {
    await injectAuth(page, { company: null })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="company-button"]')).toContainText('No seleccionada')
  })

  test('click en empresa abre el selector', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/Companies/GetCompanies**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_COMPANIES_RESPONSE) })
    )
    await page.goto(HOME_URL)
    await page.locator('[data-testid="company-button"]').click()
    await expect(page.locator('[data-testid="company-selector-modal"]')).toBeVisible()
  })
})

// ============================================================
// 8. COMPANY SELECTOR
// ============================================================
test.describe('Company Selector', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/Companies/GetCompanies**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_COMPANIES_RESPONSE) })
    )
    await page.route('**/api/Permission/GetPermsByUser**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Data: [{ Name: 'M_Documents' }], Message: '' }) })
    )
    await page.goto(HOME_URL)
    await page.locator('[data-testid="company-button"]').click()
  })

  test('modal se abre con título correcto', async ({ page }) => {
    await expect(page.locator('[data-testid="company-selector-modal"]')).toContainText('Seleccione una compañía')
  })

  test('input de búsqueda existe', async ({ page }) => {
    await expect(page.locator('[data-testid="company-search-input"]')).toBeVisible()
  })

  test('botón Cancelar existe cuando hay empresa seleccionada', async ({ page }) => {
    await expect(page.locator('[data-testid="company-cancel-btn"]')).toBeVisible()
  })

  test('botón Continuar deshabilitado sin selección', async ({ page }) => {
    await expect(page.locator('[data-testid="company-confirm-btn"]')).toBeDisabled()
  })

  test('lista muestra las empresas cargadas', async ({ page }) => {
    await expect(page.locator('[data-testid="company-option"]')).toHaveCount(2)
  })

  test('filtrar por nombre reduce las opciones', async ({ page }) => {
    await page.locator('[data-testid="company-search-input"]').fill('Otra')
    await expect(page.locator('[data-testid="company-option"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="company-option"]').first()).toContainText('Otra Empresa')
  })

  test('seleccionar empresa habilita Continuar', async ({ page }) => {
    await page.locator('[data-testid="company-option"]').first().click()
    await expect(page.locator('[data-testid="company-confirm-btn"]')).toBeEnabled()
  })

  test('cancelar cierra el modal', async ({ page }) => {
    await page.locator('[data-testid="company-cancel-btn"]').click()
    await expect(page.locator('[data-testid="company-selector-modal"]')).toBeHidden()
  })

  test('Cancelar no existe si no hay empresa seleccionada', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('CurrentCompany'))
    await page.reload()
    await page.locator('[data-testid="company-button"]').click()
    await expect(page.locator('[data-testid="company-cancel-btn"]')).toBeHidden()
  })

  test('confirmar empresa distinta guarda en localStorage y recarga', async ({ page }) => {
    await page.locator('[data-testid="company-option"]').last().click()
    await page.locator('[data-testid="company-confirm-btn"]').click()
    // Esperar reload
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {})
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('CurrentCompany') || 'null'))
    expect(stored?.companyName).toBe('Otra Empresa')
    expect(stored?.companyId).toBe(2)
  })

  test('confirmar misma empresa cierra modal sin recargar', async ({ page }) => {
    // La empresa mock ya es ID 1 (Empresa Demo)
    await page.locator('[data-testid="company-option"]').first().click()
    const navigationTriggered = await Promise.race([
      page.waitForNavigation({ timeout: 1500 }).then(() => true).catch(() => false),
      page.locator('[data-testid="company-confirm-btn"]').click().then(() => false)
    ])
    expect(navigationTriggered).toBe(false)
    await expect(page.locator('[data-testid="company-selector-modal"]')).toBeHidden()
  })
})

// ============================================================
// 9. COMPANY SELECTOR — sin empresa inicial (forzar selección)
// ============================================================
test.describe('Company Selector — sin empresa inicial', () => {
  test('modal se abre automáticamente si no hay empresa seleccionada', async ({ page }) => {
    await injectAuth(page, { company: null })
    await page.route('**/api/Companies/GetCompanies**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_COMPANIES_RESPONSE) })
    )
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="company-selector-modal"]')).toBeVisible()
  })

  test('sin empresa, modal no tiene botón Cancelar', async ({ page }) => {
    await injectAuth(page, { company: null })
    await page.route('**/api/Companies/GetCompanies**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_COMPANIES_RESPONSE) })
    )
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="company-cancel-btn"]')).toBeHidden()
  })
})
