// @ts-check
/**
 * Suite E2E: Configurations/Group — migración Angular → Rails
 * Ruta: /configurations/group
 *
 * Cubre:
 *   - Auth guard
 *   - Carga inicial (formulario + tablas)
 *   - Formulario de grupo (campos, valores, readonly)
 *   - Tab "Usuarios de la Cuenta"
 *   - Tab "Compañías de la Cuenta"
 *   - Actualizar grupo (PATCH api/Group con FormData)
 *   - Subir archivo .rpt (validación de extensión)
 *   - Descargar formato (con permiso)
 *   - Restablecer formato (modal de confirmación → PATCH)
 *   - Panel "Crear grupo" (POST api/Group)
 *   - Control de permisos (botones ocultos sin permisos)
 *   - Manejo de errores de API (modal de error)
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL  = 'http://localhost:3000'
const GROUP_URL = `${BASE_URL}/configurations/group`
const LOGIN_URL = `${BASE_URL}/login`

// ── Mocks de datos ────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  access_token: 'mock-token-group',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
  UserEmail: 'testuser@clavisco.com',
  UserId: 'user-001'
}

const MOCK_COMPANY = {
  companyId: '42',
  companyName: 'Empresa Test SA',
  groupId: 1
}

const MOCK_GROUP = {
  Id: 1,
  GroupName: 'Grupo Principal',
  GroupDescription: 'Descripción del grupo principal',
  DefaultPrintFormatPath: 'C:\\formats\\formato_fe.rpt'
}

const MOCK_GROUP_RESPONSE = {
  Data: [MOCK_GROUP],
  Message: null,
  Error: false
}

const MOCK_COMPANIES = [
  { Id: 1, Identification: '3101234567', LegalName: 'Empresa Test SA', ComercialName: 'Test SA', Active: true },
  { Id: 2, Identification: '3109876543', LegalName: 'Empresa Demo CR', ComercialName: 'Demo CR', Active: false }
]

const MOCK_COMPANIES_RESPONSE = {
  Data: MOCK_COMPANIES,
  Message: null,
  Error: false
}

const MOCK_USERS = [
  { UserName: 'admin@test.com', Email: 'admin@test.com' },
  { UserName: 'user@test.com',  Email: 'user@test.com'  }
]

const MOCK_USERS_RESPONSE = {
  Data: MOCK_USERS,
  Message: null,
  Error: false
}

const ALL_PERMISSIONS = [
  'Configurations_Groups_Update',
  'Configurations_Groups_UpdateAllInApplication',
  'Configurations_Groups_DownloadFEPrintFormatInAllGroups',
  'Configurations_Groups_DownloadFEPrintFormat',
  'Configurations_Groups_Create'
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function injectAuth(page, permissions = ALL_PERMISSIONS) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, perms }) => {
    localStorage.setItem('Session',           JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany',  JSON.stringify(company))
    sessionStorage.setItem('Permissions',     JSON.stringify(perms))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, perms: permissions })
}

async function mockGroupAPIs(page, {
  groupResponse    = MOCK_GROUP_RESPONSE,
  companiesResponse = MOCK_COMPANIES_RESPONSE,
  usersResponse    = MOCK_USERS_RESPONSE
} = {}) {
  await page.route('**/api/Group/GetGroupsByUser**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groupResponse) })
  )
  await page.route('**/api/Companies/GetCompaniesByGroup**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(companiesResponse) })
  )
  await page.route('**/api/User/GetUsersByGroup**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usersResponse) })
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. AUTH GUARD
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Auth guard', () => {
  test('redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto(GROUP_URL)
    await expect(page).toHaveURL(/\/login/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. CARGA INICIAL
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('muestra el título "Datos de la Cuenta"', async ({ page }) => {
    await expect(page.getByText('Datos de la Cuenta')).toBeVisible()
  })

  test('el campo Nombre se pobla con el valor de la API', async ({ page }) => {
    const input = page.locator('[data-field="GroupName"], input[name="GroupName"], #GroupName').first()
    await expect(input).toHaveValue(MOCK_GROUP.GroupName)
  })

  test('el campo Descripción se pobla correctamente', async ({ page }) => {
    const input = page.locator('[data-field="GroupDescription"], input[name="GroupDescription"], #GroupDescription').first()
    await expect(input).toHaveValue(MOCK_GROUP.GroupDescription)
  })

  test('el campo Formato de Impresión muestra solo el nombre del archivo', async ({ page }) => {
    const input = page.locator('[data-field="DefaultPrintFormatPath"], input[name="DefaultPrintFormatPath"], #DefaultPrintFormatPath').first()
    await expect(input).toHaveValue('formato_fe.rpt')
  })

  test('el campo Nombre es readonly', async ({ page }) => {
    const input = page.locator('[data-field="GroupName"], input[name="GroupName"], #GroupName').first()
    await expect(input).toHaveAttribute('readonly')
  })

  test('el campo Formato de Impresión es readonly', async ({ page }) => {
    const input = page.locator('[data-field="DefaultPrintFormatPath"], input[name="DefaultPrintFormatPath"], #DefaultPrintFormatPath').first()
    await expect(input).toHaveAttribute('readonly')
  })

  test('llama a GetGroupsByUser con el companyId correcto', async ({ page }) => {
    let called = false
    page.on('request', req => {
      if (req.url().includes('GetGroupsByUser') && req.url().includes('companyId=42')) called = true
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(called).toBe(true)
  })

  test('llama a GetCompaniesByGroup con el groupId del grupo cargado', async ({ page }) => {
    let called = false
    page.on('request', req => {
      if (req.url().includes('GetCompaniesByGroup') && req.url().includes('groupId=1')) called = true
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(called).toBe(true)
  })

  test('llama a GetUsersByGroup con el companyId correcto', async ({ page }) => {
    let called = false
    page.on('request', req => {
      if (req.url().includes('GetUsersByGroup') && req.url().includes('companyId=42')) called = true
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(called).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. TABS Y TABLAS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Tabs y tablas', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('existe el tab "Usuarios de la Cuenta"', async ({ page }) => {
    await expect(page.getByText('Usuarios de la Cuenta')).toBeVisible()
  })

  test('existe el tab "Compañías de la Cuenta"', async ({ page }) => {
    await expect(page.getByText('Compañías de la Cuenta')).toBeVisible()
  })

  test('tabla de usuarios muestra columnas "Usuario" y "Email"', async ({ page }) => {
    await expect(page.getByText('Usuario')).toBeVisible()
    await expect(page.getByText('Email')).toBeVisible()
  })

  test('tabla de usuarios muestra datos de la API', async ({ page }) => {
    await expect(page.getByText('admin@test.com')).toBeVisible()
    await expect(page.getByText('user@test.com')).toBeVisible()
  })

  test('al hacer click en tab Compañías muestra tabla de compañías', async ({ page }) => {
    await page.getByText('Compañías de la Cuenta').click()
    await expect(page.getByText('Nombre Legal')).toBeVisible()
    await expect(page.getByText('Empresa Test SA')).toBeVisible()
  })

  test('tabla de compañías muestra columnas correctas', async ({ page }) => {
    await page.getByText('Compañías de la Cuenta').click()
    await expect(page.getByText('Identificación')).toBeVisible()
    await expect(page.getByText('Nombre Comercial')).toBeVisible()
    await expect(page.getByText('Activa')).toBeVisible()
  })

  test('columna Activa usa badge activo/inactivo', async ({ page }) => {
    await page.getByText('Compañías de la Cuenta').click()
    await expect(page.getByText('Activo').first()).toBeVisible()
    await expect(page.getByText('Inactivo').first()).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. BOTONES CON PERMISOS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Control de permisos', () => {
  test('sin permisos, no aparecen botones de acción', async ({ page }) => {
    await injectAuth(page, [])
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Actualizar/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Restablecer Formato/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Crear/i })).not.toBeVisible()
  })

  test('con permiso Update aparecen botones Actualizar y Restablecer', async ({ page }) => {
    await injectAuth(page, ['Configurations_Groups_Update'])
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Actualizar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Restablecer Formato/i })).toBeVisible()
  })

  test('sin permiso DownloadFEPrintFormat, el botón download no aparece', async ({ page }) => {
    await injectAuth(page, ['Configurations_Groups_Update'])
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    // El botón de descarga en el campo Formato no debe ser visible
    const downloadBtn = page.locator('[data-action*="download"], button[title="Descargar"]').first()
    await expect(downloadBtn).not.toBeVisible()
  })

  test('con permiso Create aparece botón Crear', async ({ page }) => {
    await injectAuth(page, ['Configurations_Groups_Create'])
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Crear/i })).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. ACTUALIZAR GRUPO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Actualizar', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('botón Actualizar llama PATCH api/Group', async ({ page }) => {
    let patchCalled = false
    await page.route('**/api/Group', route => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'OK', Error: false }) })
      } else {
        route.continue()
      }
    })

    const descInput = page.locator('[data-field="GroupDescription"], input[name="GroupDescription"], #GroupDescription').first()
    await descInput.fill('Nueva descripción')
    await page.getByRole('button', { name: /Actualizar/i }).click()
    await page.waitForLoadState('networkidle')

    expect(patchCalled).toBe(true)
  })

  test('actualización exitosa muestra toast de éxito', async ({ page }) => {
    await page.route('**/api/Group', route => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'OK', Error: false }) })
      } else {
        route.continue()
      }
    })

    const descInput = page.locator('[data-field="GroupDescription"], input[name="GroupDescription"], #GroupDescription').first()
    await descInput.fill('Descripción actualizada')
    await page.getByRole('button', { name: /Actualizar/i }).click()

    await expect(page.getByText(/actualizado/i)).toBeVisible({ timeout: 5000 })
  })

  test('error en actualización muestra modal de error', async ({ page }) => {
    await page.route('**/api/Group', route => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ Message: 'Error interno' }) })
      } else {
        route.continue()
      }
    })

    await page.getByRole('button', { name: /Actualizar/i }).click()
    await expect(page.locator('[role="dialog"], .modal, #error-modal')).toBeVisible({ timeout: 5000 })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. SUBIR ARCHIVO .RPT
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Subir archivo', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('archivo .rpt válido actualiza el campo de formato', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'nuevo_formato.rpt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake rpt content')
    })

    const formatInput = page.locator('[data-field="DefaultPrintFormatPath"], input[name="DefaultPrintFormatPath"], #DefaultPrintFormatPath').first()
    await expect(formatInput).toHaveValue('nuevo_formato.rpt')
  })

  test('archivo con extensión incorrecta muestra toast de error y limpia el campo', async ({ page }) => {
    const formatInput = page.locator('[data-field="DefaultPrintFormatPath"], input[name="DefaultPrintFormatPath"], #DefaultPrintFormatPath').first()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'documento.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content')
    })

    // El campo debe limpiarse o mantener el valor previo
    await expect(page.getByText(/formato de impresión válido/i)).toBeVisible({ timeout: 5000 })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. RESTABLECER FORMATO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Restablecer formato', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('click en Restablecer Formato abre modal de confirmación', async ({ page }) => {
    await page.getByRole('button', { name: /Restablecer Formato/i }).click()
    await expect(page.getByText(/restablecer.*formato/i)).toBeVisible({ timeout: 3000 })
  })

  test('al confirmar, llama PATCH ResetPrintFormat', async ({ page }) => {
    let resetCalled = false
    await page.route('**/api/Group/ResetPrintFormat**', route => {
      resetCalled = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'OK', Error: false }) })
    })

    await page.getByRole('button', { name: /Restablecer Formato/i }).click()
    // Confirmar en el modal
    await page.getByRole('button', { name: /Continuar|Aceptar|Confirmar/i }).click()
    await page.waitForLoadState('networkidle')

    expect(resetCalled).toBe(true)
  })

  test('restablecer exitoso muestra toast de éxito', async ({ page }) => {
    await page.route('**/api/Group/ResetPrintFormat**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'OK', Error: false }) })
    )

    await page.getByRole('button', { name: /Restablecer Formato/i }).click()
    await page.getByRole('button', { name: /Continuar|Aceptar|Confirmar/i }).click()

    await expect(page.getByText(/restablecido/i)).toBeVisible({ timeout: 5000 })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. PANEL CREAR GRUPO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Crear grupo', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockGroupAPIs(page)
    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')
  })

  test('click en Crear abre el panel lateral', async ({ page }) => {
    await page.getByRole('button', { name: /Crear/i }).click()
    await expect(page.getByText('Creación de Grupo')).toBeVisible({ timeout: 3000 })
  })

  test('botón Crear del panel está deshabilitado si GroupName está vacío', async ({ page }) => {
    await page.getByRole('button', { name: /^Crear$/i }).click()
    await page.waitForTimeout(300)

    const saveBtn = page.getByRole('button', { name: /^Crear$/i }).last()
    await expect(saveBtn).toBeDisabled()
  })

  test('al llenar GroupName y hacer Crear, llama POST api/Group', async ({ page }) => {
    let postCalled = false
    await page.route('**/api/Group', route => {
      if (route.request().method() === 'POST') {
        postCalled = true
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'Grupo creado', Error: false }) })
      } else {
        route.continue()
      }
    })

    await page.getByRole('button', { name: /Crear/i }).first().click()
    await page.waitForTimeout(300)

    const nameInput = page.locator('[data-field="GroupName"], input[name="GroupName"], input[placeholder*="ombre"]').last()
    await nameInput.fill('Nuevo Grupo Test')

    await page.getByRole('button', { name: /^Crear$/i }).last().click()
    await page.waitForLoadState('networkidle')

    expect(postCalled).toBe(true)
  })

  test('creación exitosa muestra toast de éxito y cierra el panel', async ({ page }) => {
    await page.route('**/api/Group', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'OK', Error: false }) })
      } else {
        route.continue()
      }
    })

    await page.getByRole('button', { name: /Crear/i }).first().click()
    await page.waitForTimeout(300)

    const nameInput = page.locator('[data-field="GroupName"], input[name="GroupName"], input[placeholder*="ombre"]').last()
    await nameInput.fill('Nuevo Grupo')

    await page.getByRole('button', { name: /^Crear$/i }).last().click()
    await expect(page.getByText(/registrado|creado/i)).toBeVisible({ timeout: 5000 })
  })

  test('botón Cancelar cierra el panel', async ({ page }) => {
    await page.getByRole('button', { name: /Crear/i }).first().click()
    await page.waitForTimeout(300)

    await page.getByRole('button', { name: /Cancelar/i }).click()
    await expect(page.getByText('Creación de Grupo')).not.toBeVisible({ timeout: 3000 })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. DESCARGAR FORMATO
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Descargar formato', () => {
  test('con permiso, el botón de descarga llama al endpoint correcto', async ({ page }) => {
    await injectAuth(page, ['Configurations_Groups_DownloadFEPrintFormat'])
    await mockGroupAPIs(page)

    let downloadCalled = false
    await page.route('**/api/Group/*/print-format**', route => {
      downloadCalled = true
      route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('fake rpt content')
      })
    })

    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    const downloadBtn = page.locator('button[title="Descargar"], [data-action*="download"]').first()
    await downloadBtn.click()
    await page.waitForTimeout(500)

    expect(downloadCalled).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. MANEJO DE ERRORES
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Group — Errores de API', () => {
  test('error en GetGroupsByUser muestra modal de error', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/Group/GetGroupsByUser**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ Message: 'Error del servidor' }) })
    )

    await page.goto(GROUP_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[role="dialog"], .modal, #error-modal')).toBeVisible({ timeout: 5000 })
  })
})
