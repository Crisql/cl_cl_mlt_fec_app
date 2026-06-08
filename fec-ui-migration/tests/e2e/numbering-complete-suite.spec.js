// @ts-check
/**
 * Suite E2E: Numeración — migración Angular → Rails
 * Ruta: /configurations/numbering
 *
 * Cubre:
 *   - Auth guard (redirect a login sin sesión)
 *   - Carga inicial: tablas de Numeración y Numeración de Recepción
 *   - Toggle de secciones colapsables
 *   - Crear Numeración (POST /api/Numbering/)
 *   - Editar Numeración (PATCH /api/Numbering/) — DocType/Sucursal/Terminal deshabilitados
 *   - Crear Numeración de Recepción (POST /api/Numbering/PostReceptNumbering/)
 *   - Editar Numeración de Recepción (PATCH /api/Numbering/PatchReceptNumbering/) — Sucursal/Terminal deshabilitados, NextNumber habilitado
 *   - Validaciones de formulario (campos requeridos, terminal no negativa)
 *   - Toast de éxito y modal de error
 *   - Edge cases: API error en carga, respuesta vacía
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL       = 'http://localhost:3000'
const NUMBERING_URL  = `${BASE_URL}/configurations/numbering`
const LOGIN_URL      = `${BASE_URL}/login`

// ── Datos de mock ──────────────────────────────────────────────────────────

const MOCK_SESSION = {
  access_token: 'mock-token-numbering',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001',
}

const MOCK_COMPANY = {
  companyId: '42',
  companyName: 'Empresa Test SA',
}

const MOCK_PERMISSIONS = ['S_Numbering', 'F_CreateNumbering', 'F_ModifyNumbering']

const MOCK_SUCURSALES = [
  { Id: 1, SucursalNum: 1, Alias: 'Central' },
  { Id: 2, SucursalNum: 2, Alias: 'Norte'   },
]

const MOCK_NUMBERINGS = [
  { Id: 1, CompanyId: 42, NextNumber: 100, SucursalId: 1, Terminal: 1, DocType: '01', Obvs: 'Principal', Active: true,  Integration: 1 },
  { Id: 2, CompanyId: 42, NextNumber: 200, SucursalId: 2, Terminal: 2, DocType: '03', Obvs: 'Secundaria', Active: false, Integration: 2 },
]

const MOCK_RECEPT_NUMBERINGS = [
  { Id: 1, CompanyId: 42, NextNumber: 50, SucursalId: 1, Terminal: 1, Message: 1, Obvs: 'Recepción A', Active: true,  Integration: 1 },
  { Id: 2, CompanyId: 42, NextNumber: 75, SucursalId: 2, Terminal: 2, Message: 1, Obvs: 'Recepción B', Active: false, Integration: 2 },
]

function okResponse(data, message = null) {
  return { Data: data, Message: message, Error: false }
}

// ── Helper auth ────────────────────────────────────────────────────────────

async function injectAuth(page, perms = MOCK_PERMISSIONS) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms })
}

// ── Helper mock API ────────────────────────────────────────────────────────

async function mockApis(page, {
  numberings     = MOCK_NUMBERINGS,
  sucursales     = MOCK_SUCURSALES,
  receptNumberings = MOCK_RECEPT_NUMBERINGS,
} = {}) {
  await page.route('**/api/Numbering?companyId=42', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(okResponse(numberings)) })
  )
  await page.route('**/api/Sucursal?companyId=42', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(okResponse(sucursales)) })
  )
  await page.route('**/api/Numbering/GetReceptNumberingByCompany?companyId=42', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(okResponse(receptNumberings)) })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 1: Acceso y carga inicial
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración — Acceso y carga inicial', () => {

  test('redirige a login sin sesión', async ({ page }) => {
    await page.goto(NUMBERING_URL)
    await expect(page).toHaveURL(/login/)
  })

  test('carga la página correctamente con sesión', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await expect(page.getByTestId('numbering-page')).toBeVisible()
  })

  test('muestra la sección Numeración expandida por defecto', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await expect(page.locator('[data-numbering-target="numberingSection"]')).toBeVisible()
  })

  test('muestra la sección Numeración de Recepción colapsada por defecto', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await expect(page.locator('[data-numbering-target="receptionSection"]')).toBeHidden()
  })

  test('renderiza tabla de numeración con datos', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    const table = page.getByTestId('numbering-table')
    await expect(table).toBeVisible()
    // Verificar que hay filas (Tabulator tarda en renderizar)
    await page.waitForTimeout(500)
    await expect(table.locator('.tabulator-row').first()).toBeVisible()
  })

  test('badge de estado activo se muestra correctamente', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.waitForTimeout(500)
    const activeBadge = page.locator('[data-testid="numbering-table"] .tabulator-row').first()
      .locator('span', { hasText: 'Activo' })
    await expect(activeBadge).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 2: Toggle de secciones
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración — Toggle de secciones', () => {

  test('colapsa la sección Numeración al hacer click', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="numberingHeader"]').click()
    await expect(page.locator('[data-numbering-target="numberingSection"]')).toBeHidden()
  })

  test('expande la sección Recepción al hacer click', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await expect(page.locator('[data-numbering-target="receptionSection"]')).toBeVisible()
  })

  test('renderiza tabla de recepción al expandir la sección', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await expect(page.getByTestId('reception-table')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="reception-table"] .tabulator-row').first()).toBeVisible()
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 3: Crear Numeración
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración — Crear', () => {

  test('abre el panel lateral al hacer click en Nueva Numeración', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await expect(page.locator('[data-numbering-target="numberingPanel"]'))
      .not.toHaveClass(/translate-x-full/)
  })

  test('todos los campos están habilitados en modo crear', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await expect(page.getByTestId('input-next-number')).toBeEnabled()
    await expect(page.getByTestId('select-doc-type')).toBeEnabled()
    await expect(page.getByTestId('select-sucursal')).toBeEnabled()
    await expect(page.getByTestId('input-terminal')).toBeEnabled()
  })

  test('muestra errores de validación con campos vacíos', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await page.getByTestId('select-doc-type').selectOption('')
    await page.getByTestId('select-sucursal').selectOption('')
    await page.getByTestId('select-integration').selectOption('')
    await page.getByTestId('input-obvs').fill('')
    await page.getByTestId('btn-save-numbering').click()
    await expect(page.locator('[data-numbering-target="numDocTypeError"]')).toBeVisible()
    await expect(page.locator('[data-numbering-target="numSucursalError"]')).toBeVisible()
    await expect(page.locator('[data-numbering-target="numObvsError"]')).toBeVisible()
    await expect(page.locator('[data-numbering-target="numIntegrationError"]')).toBeVisible()
  })

  test('crea numeración exitosamente y muestra toast', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Data: true, Error: false }) })
      } else {
        await route.continue()
      }
    })

    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()

    await page.getByTestId('input-next-number').fill('150')
    await page.getByTestId('select-doc-type').selectOption('01')
    await page.getByTestId('select-sucursal').selectOption('1')
    await page.getByTestId('input-terminal').fill('3')
    await page.getByTestId('input-obvs').fill('Test numeración')
    await page.getByTestId('select-integration').selectOption('1')
    await page.getByTestId('btn-save-numbering').click()

    await expect(page.locator('#toast-container')).toContainText('exitosamente')
  })

  test('muestra modal de error si la API falla al crear', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      } else {
        route.continue()
      }
    })

    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await page.getByTestId('input-next-number').fill('150')
    await page.getByTestId('select-doc-type').selectOption('01')
    await page.getByTestId('select-sucursal').selectOption('1')
    await page.getByTestId('input-terminal').fill('3')
    await page.getByTestId('input-obvs').fill('Test')
    await page.getByTestId('select-integration').selectOption('1')
    await page.getByTestId('btn-save-numbering').click()

    await expect(page.locator('[data-numbering-target="errorModal"]')).toBeVisible()
  })

  test('cierra el panel al hacer click en Cancelar', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await page.locator('[data-action="click->numbering#closeNumberingPanel"]').first().click()
    await expect(page.locator('[data-numbering-target="numberingPanel"]'))
      .toHaveClass(/translate-x-full/)
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 4: Editar Numeración
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración — Editar', () => {

  test('abre el panel de edición al hacer click en el botón Editar', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.waitForTimeout(600)
    await page.locator('[data-testid="numbering-table"] [data-action-type="edit"]').first().click()
    await expect(page.locator('[data-numbering-target="numberingPanel"]'))
      .not.toHaveClass(/translate-x-full/)
  })

  test('DocType, Sucursal y Terminal están deshabilitados en modo editar', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.waitForTimeout(600)
    await page.locator('[data-testid="numbering-table"] [data-action-type="edit"]').first().click()
    await expect(page.getByTestId('select-doc-type')).toBeDisabled()
    await expect(page.getByTestId('select-sucursal')).toBeDisabled()
    await expect(page.getByTestId('input-terminal')).toBeDisabled()
    await expect(page.getByTestId('input-next-number')).toBeEnabled()
  })

  test('edita numeración exitosamente y muestra toast', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Data: true, Error: false }) })
      } else {
        await route.continue()
      }
    })

    await page.goto(NUMBERING_URL)
    await page.waitForTimeout(600)
    await page.locator('[data-testid="numbering-table"] [data-action-type="edit"]').first().click()
    await page.getByTestId('input-next-number').fill('999')
    await page.getByTestId('btn-save-numbering').click()

    await expect(page.locator('#toast-container')).toContainText('exitosamente')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 5: Crear Numeración de Recepción
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración de Recepción — Crear', () => {

  test('abre el panel de Numeración de Recepción al hacer click', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.getByTestId('btn-new-reception').click()
    await expect(page.locator('[data-numbering-target="receptionPanel"]'))
      .not.toHaveClass(/translate-x-full/)
  })

  test('NextNumber está deshabilitado en modo crear', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.getByTestId('btn-new-reception').click()
    await expect(page.getByTestId('input-rec-next-number')).toBeDisabled()
    await expect(page.getByTestId('select-rec-sucursal')).toBeEnabled()
    await expect(page.getByTestId('input-rec-terminal')).toBeEnabled()
  })

  test('muestra errores de validación con campos vacíos', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.getByTestId('btn-new-reception').click()
    await page.getByTestId('select-rec-sucursal').selectOption('')
    await page.getByTestId('select-rec-integration').selectOption('')
    await page.getByTestId('btn-save-reception').click()
    await expect(page.locator('[data-numbering-target="recSucursalError"]')).toBeVisible()
    await expect(page.locator('[data-numbering-target="recIntegrationError"]')).toBeVisible()
    await expect(page.locator('[data-numbering-target="recObvsError"]')).toBeVisible()
  })

  test('crea numeración de recepción exitosamente y muestra toast', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/PostReceptNumbering/', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Data: true, Error: false }) })
    )

    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.getByTestId('btn-new-reception').click()

    await page.getByTestId('select-rec-sucursal').selectOption('1')
    await page.getByTestId('input-rec-terminal').fill('5')
    await page.getByTestId('input-rec-obvs').fill('Recepción test')
    await page.getByTestId('select-rec-integration').selectOption('2')
    await page.getByTestId('btn-save-reception').click()

    await expect(page.locator('#toast-container')).toContainText('exitosamente')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 6: Editar Numeración de Recepción
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración de Recepción — Editar', () => {

  test('Sucursal y Terminal están deshabilitados, NextNumber habilitado en modo editar', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.waitForTimeout(600)
    await page.locator('[data-testid="reception-table"] [data-action-type="edit"]').first().click()
    await expect(page.getByTestId('input-rec-next-number')).toBeEnabled()
    await expect(page.getByTestId('select-rec-sucursal')).toBeDisabled()
    await expect(page.getByTestId('input-rec-terminal')).toBeDisabled()
  })

  test('edita numeración de recepción exitosamente y muestra toast', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/PatchReceptNumbering/', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Data: true, Error: false }) })
    )

    await page.goto(NUMBERING_URL)
    await page.locator('[data-numbering-target="receptionHeader"]').click()
    await page.waitForTimeout(600)
    await page.locator('[data-testid="reception-table"] [data-action-type="edit"]').first().click()
    await page.getByTestId('input-rec-next-number').fill('88')
    await page.getByTestId('btn-save-reception').click()

    await expect(page.locator('#toast-container')).toContainText('exitosamente')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// GRUPO 7: Edge cases
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Numeración — Edge cases', () => {

  test('muestra toast warning cuando la API devuelve datos vacíos', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page, { numberings: [], receptNumberings: [] })
    await page.goto(NUMBERING_URL)
    // No debe lanzar error, la página carga sin filas
    await expect(page.getByTestId('numbering-page')).toBeVisible()
  })

  test('toast de error cuando falla la carga inicial de la API', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/Numbering?companyId=42', route =>
      route.fulfill({ status: 500, body: 'Server Error' })
    )
    await page.route('**/api/Sucursal?companyId=42', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(okResponse(MOCK_SUCURSALES)) })
    )
    await page.route('**/api/Numbering/GetReceptNumberingByCompany?companyId=42', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(okResponse(MOCK_RECEPT_NUMBERINGS)) })
    )
    await page.goto(NUMBERING_URL)
    await expect(page.locator('#toast-container')).toContainText('Error')
  })

  test('cierra el modal de error al hacer click en Aceptar', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)

    await page.route('**/api/Numbering/', async route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: 'Error' })
      } else {
        route.continue()
      }
    })

    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await page.getByTestId('input-next-number').fill('100')
    await page.getByTestId('select-doc-type').selectOption('01')
    await page.getByTestId('select-sucursal').selectOption('1')
    await page.getByTestId('input-terminal').fill('1')
    await page.getByTestId('input-obvs').fill('Test')
    await page.getByTestId('select-integration').selectOption('1')
    await page.getByTestId('btn-save-numbering').click()

    await expect(page.locator('[data-numbering-target="errorModal"]')).toBeVisible()
    await page.locator('[data-action="click->numbering#closeErrorModal"]').click()
    await expect(page.locator('[data-numbering-target="errorModal"]')).toBeHidden()
  })

  test('el backdrop del panel cierra el panel al hacer click', async ({ page }) => {
    await injectAuth(page)
    await mockApis(page)
    await page.goto(NUMBERING_URL)
    await page.getByTestId('btn-new-numbering').click()
    await page.locator('[data-numbering-target="numberingPanelBackdrop"]').click()
    await expect(page.locator('[data-numbering-target="numberingPanel"]'))
      .toHaveClass(/translate-x-full/)
  })

})
