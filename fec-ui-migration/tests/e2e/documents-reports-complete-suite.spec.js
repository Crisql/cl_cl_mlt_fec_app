// @ts-check
/**
 * Suite E2E: Reportes de Documentos — migración Angular → Rails
 * Ruta: /documents-reports
 *
 * Cubre:
 *   - Auth guard
 *   - Carga inicial con permisos S_DocumentReport y S_DocumentReceptionReport
 *   - Visibilidad de radio buttons según permisos
 *   - Botones "Hoy" para StartDate y EndDate
 *   - Validación: fechas nulas
 *   - Validación: fecha futura o StartDate > EndDate
 *   - Generación de reporte de documentos (PDF en nueva pestaña)
 *   - Generación de reporte de recepción (PDF en nueva pestaña)
 *   - Toast warning cuando no hay datos
 *   - Toast error cuando API falla
 *   - Overlay durante la carga
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL   = 'http://localhost:3000'
const PAGE_URL   = `${BASE_URL}/documents-reports`
const LOGIN_URL  = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-reports',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001'
}

const MOCK_COMPANY = {
  companyId: '42',
  companyName: 'Empresa Test SA'
}

const ALL_REPORT_PERMS  = ['S_DocumentReport', 'S_DocumentReceptionReport']
const ONLY_DOC_PERM     = ['S_DocumentReport']
const ONLY_RECEP_PERM   = ['S_DocumentReceptionReport']

// Helper: inyecta auth y navega a la página
async function injectAuth(page, perms = ALL_REPORT_PERMS) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms })
  await page.goto(PAGE_URL)
}

// Helper: mock exitoso de la API de reportes (retorna base64 de un PDF mínimo)
const MINIMAL_PDF_BASE64 = 'JVBERi0xLjAKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjE5MAolJUVPRgo='

async function mockReportSuccess(page, endpoint) {
  await page.route(`**/api/Report/${endpoint}**`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MINIMAL_PDF_BASE64, Message: null })
    })
  })
}

async function mockReportEmpty(page, endpoint) {
  await page.route(`**/api/Report/${endpoint}**`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: null, Message: null })
    })
  })
}

async function mockReportError(page, endpoint) {
  await page.route(`**/api/Report/${endpoint}**`, route => {
    route.fulfill({
      status: 500,
      headers: { 'cl-message': encodeURIComponent('Error interno del servidor') },
      body: 'Error'
    })
  })
}

// --------------------------------------------------------------------------
// AUTH GUARD
// --------------------------------------------------------------------------

test.describe('Auth Guard', () => {
  test('redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page).toHaveURL(/\/login/)
  })
})

// --------------------------------------------------------------------------
// CARGA INICIAL
// --------------------------------------------------------------------------

test.describe('Carga inicial', () => {
  test('muestra los dos radio buttons con ambos permisos', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    await expect(page.locator('[data-report-type="1"]')).toBeVisible()
    await expect(page.locator('[data-report-type="2"]')).toBeVisible()
  })

  test('solo muestra radio "Reporte de Documentos" con perm S_DocumentReport', async ({ page }) => {
    await injectAuth(page, ONLY_DOC_PERM)
    await expect(page.locator('[data-report-type="1"]')).toBeVisible()
    await expect(page.locator('[data-report-type="2"]')).not.toBeVisible()
  })

  test('solo muestra radio "Reporte de Documentos Recepcionados" con perm S_DocumentReceptionReport', async ({ page }) => {
    await injectAuth(page, ONLY_RECEP_PERM)
    await expect(page.locator('[data-report-type="1"]')).not.toBeVisible()
    await expect(page.locator('[data-report-type="2"]')).toBeVisible()
  })

  test('el campo StartDate tiene la fecha de hoy por defecto', async ({ page }) => {
    await injectAuth(page)
    const today = new Date().toISOString().slice(0, 10)
    const val   = await page.locator('[data-reports-target="startDate"]').inputValue()
    expect(val).toBe(today)
  })

  test('el campo EndDate tiene la fecha de hoy por defecto', async ({ page }) => {
    await injectAuth(page)
    const today = new Date().toISOString().slice(0, 10)
    const val   = await page.locator('[data-reports-target="endDate"]').inputValue()
    expect(val).toBe(today)
  })

  test('el radio ToggleRD=1 está seleccionado por defecto cuando tiene S_DocumentReport', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    const radio = page.locator('[data-report-type="1"]')
    await expect(radio).toBeChecked()
  })
})

// --------------------------------------------------------------------------
// BOTONES HOY
// --------------------------------------------------------------------------

test.describe('Botones Hoy', () => {
  test('botón Hoy de StartDate setea fecha actual', async ({ page }) => {
    await injectAuth(page)
    const input = page.locator('[data-reports-target="startDate"]')
    await input.fill('2020-01-01')
    await page.locator('[data-action="click->documents-reports#setTodayStart"]').click()
    const today = new Date().toISOString().slice(0, 10)
    await expect(input).toHaveValue(today)
  })

  test('botón Hoy de EndDate setea fecha actual', async ({ page }) => {
    await injectAuth(page)
    const input = page.locator('[data-reports-target="endDate"]')
    await input.fill('2020-01-01')
    await page.locator('[data-action="click->documents-reports#setTodayEnd"]').click()
    const today = new Date().toISOString().slice(0, 10)
    await expect(input).toHaveValue(today)
  })
})

// --------------------------------------------------------------------------
// VALIDACIONES
// --------------------------------------------------------------------------

test.describe('Validaciones del formulario', () => {
  test('botón Consultar deshabilitado si StartDate está vacío', async ({ page }) => {
    await injectAuth(page)
    await page.locator('[data-reports-target="startDate"]').fill('')
    await expect(page.locator('[data-action="click->documents-reports#submit"]')).toBeDisabled()
  })

  test('botón Consultar deshabilitado si EndDate está vacío', async ({ page }) => {
    await injectAuth(page)
    await page.locator('[data-reports-target="endDate"]').fill('')
    await expect(page.locator('[data-action="click->documents-reports#submit"]')).toBeDisabled()
  })

  test('muestra modal de error si StartDate es posterior a EndDate', async ({ page }) => {
    await injectAuth(page)
    const today     = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await page.locator('[data-reports-target="startDate"]').fill(today)
    await page.locator('[data-reports-target="endDate"]').fill(yesterday)
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('.cl-modal, [role="dialog"]')).toBeVisible()
  })

  test('muestra modal de error si StartDate es fecha futura', async ({ page }) => {
    await injectAuth(page)
    const future = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
    await page.locator('[data-reports-target="startDate"]').fill(future)
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('.cl-modal, [role="dialog"]')).toBeVisible()
  })
})

// --------------------------------------------------------------------------
// REPORTE DE DOCUMENTOS (ToggleRD = 1)
// --------------------------------------------------------------------------

test.describe('Reporte de Documentos', () => {
  test('llama a /api/Report/GetDocReport con parámetros correctos', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    let capturedUrl = ''
    await page.route('**/api/Report/GetDocReport**', route => {
      capturedUrl = route.request().url()
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ Data: MINIMAL_PDF_BASE64, Message: null }) })
    })
    await page.locator('[data-report-type="1"]').check()
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    expect(capturedUrl).toContain('StartDate=2025-01-01')
    expect(capturedUrl).toContain('EndDate=2025-01-31')
    expect(capturedUrl).toContain('CompanyId=42')
  })

  test('abre PDF en nueva pestaña cuando hay datos', async ({ page, context }) => {
    await injectAuth(page, ONLY_DOC_PERM)
    await mockReportSuccess(page, 'GetDocReport')
    const newTabPromise = context.waitForEvent('page')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    const newTab = await newTabPromise
    expect(newTab).toBeTruthy()
  })

  test('muestra toast warning cuando Data es null', async ({ page }) => {
    await injectAuth(page, ONLY_DOC_PERM)
    await mockReportEmpty(page, 'GetDocReport')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('#toast-container')).toContainText('no hay información disponible')
  })

  test('muestra toast error cuando la API falla', async ({ page }) => {
    await injectAuth(page, ONLY_DOC_PERM)
    await mockReportError(page, 'GetDocReport')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('#toast-container')).toBeVisible()
  })
})

// --------------------------------------------------------------------------
// REPORTE DE DOCUMENTOS RECEPCIONADOS (ToggleRD = 2)
// --------------------------------------------------------------------------

test.describe('Reporte de Documentos Recepcionados', () => {
  test('llama a /api/Report/GetDocReceptReport con parámetros correctos', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    let capturedUrl = ''
    await page.route('**/api/Report/GetDocReceptReport**', route => {
      capturedUrl = route.request().url()
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ Data: MINIMAL_PDF_BASE64, Message: null }) })
    })
    await page.locator('[data-report-type="2"]').check()
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    expect(capturedUrl).toContain('StartDate=2025-01-01')
    expect(capturedUrl).toContain('EndDate=2025-01-31')
    expect(capturedUrl).toContain('CompanyId=42')
  })

  test('abre PDF en nueva pestaña cuando hay datos', async ({ page, context }) => {
    await injectAuth(page, ONLY_RECEP_PERM)
    await mockReportSuccess(page, 'GetDocReceptReport')
    const newTabPromise = context.waitForEvent('page')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    const newTab = await newTabPromise
    expect(newTab).toBeTruthy()
  })

  test('muestra toast warning cuando Data es null', async ({ page }) => {
    await injectAuth(page, ONLY_RECEP_PERM)
    await mockReportEmpty(page, 'GetDocReceptReport')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('#toast-container')).toContainText('no hay información disponible')
  })

  test('muestra toast error cuando la API falla', async ({ page }) => {
    await injectAuth(page, ONLY_RECEP_PERM)
    await mockReportError(page, 'GetDocReceptReport')
    await page.locator('[data-reports-target="startDate"]').fill('2025-01-01')
    await page.locator('[data-reports-target="endDate"]').fill('2025-01-31')
    await page.locator('[data-action="click->documents-reports#submit"]').click()
    await expect(page.locator('#toast-container')).toBeVisible()
  })
})

// --------------------------------------------------------------------------
// MENÚ
// --------------------------------------------------------------------------

test.describe('Menú — ítem Reportes', () => {
  test('el ítem Reportes en el menú apunta a /documents-reports', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    const link = page.locator('[data-route="/documents-reports"]')
    await expect(link).toBeVisible()
  })

  test('clic en Reportes navega a /documents-reports', async ({ page }) => {
    await injectAuth(page, ALL_REPORT_PERMS)
    await page.locator('[data-route="/documents-reports"]').click()
    await expect(page).toHaveURL(/\/documents-reports/)
  })
})
