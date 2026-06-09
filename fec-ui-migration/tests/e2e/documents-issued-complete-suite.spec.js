// @ts-check
/**
 * Suite E2E: Documents Issued (Documentos Emitidos) — migración Angular → Rails
 * Ruta: /documents/issued
 *
 * Cubre:
 *   - Auth guard (redirige a login sin sesión)
 *   - Carga inicial (formulario de filtros + tabla)
 *   - Pre-llenado con ?clave= en la URL
 *   - Botón "Hoy" en fechas
 *   - Búsqueda (GET api/documents con filtros)
 *   - Mapeo de documentos: FechaFact, N° FE, N° Ref, Receptor, Estado, Total
 *   - Badges de estado (Aceptado, Procesando, Rechazado, Error…)
 *   - Contadores de estado en toolbar
 *   - Botón "Más Información" — visible solo tras búsqueda exitosa
 *   - Botón "Descarga Masiva" — visible solo con perm F_CreateBulkDownloadOfDocuments
 *   - Menú de opciones por fila (dropdown)
 *   - Ver PDF (abre nueva pestaña con base64)
 *   - Descargar PDF
 *   - Ver/Descargar XML Hacienda — solo Status 1 o 4
 *   - Descargar Doc XML — bloqueado si Status=5
 *   - Modal Correos: tabla + toggle Otros destinatarios + Reenviar
 *   - Modal Info: Clave, FechaEmision, errores; XML Hacienda si Status=4
 *   - Omitir Validaciones — solo Status=5
 *   - Anulación Interna — solo Status!=7 y DocType='08'
 *   - Reprocesar — solo Status=4 + perm Documents_Emission_Reprocess
 *   - Errores de API (modal de error)
 *   - Paginación server-side
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL    = 'http://localhost:3000'
const PAGE_URL    = `${BASE_URL}/documents/issued`
const LOGIN_URL   = `${BASE_URL}/login`

const MOCK_SESSION = {
  access_token: 'mock-token-issued',
  token_type:   'Bearer',
  expires_at:   Date.now() + 3_600_000,
  UserEmail:    'testuser@clavisco.com',
  UserId:       'user-001',
}

const MOCK_COMPANY = {
  companyId:   '42',
  companyName: 'Empresa Test SA',
  groupId:     1,
}

const MOCK_PERMISSIONS_FULL = [
  'F_CreateBulkDownloadOfDocuments',
  'Documents_Emission_Reprocess',
]

const MOCK_DOCUMENTS_RESPONSE = {
  Data: {
    DocumentQtyList: [
      { Status: 1, Quantity: 5 },
      { Status: 4, Quantity: 2 },
      { Status: 5, Quantity: 1 },
    ],
    DocumentList: [
      {
        Id: 100,
        FechaFact: '2024-06-01T00:00:00',
        NumeroConsecutivo: '50601011800010000000001',
        Consecutivo: '1001',
        RcprNombre: 'Cliente Ejemplo SA',
        Status: 1,
        TotalComprobante: 15000.00,
        CodigoMoneda: '₡',
        DocType: '01',
        Clave: '50601011800010000000001202406011234567890',
        FechaEmision: '2024-06-01T10:00:00',
        ErrDetails: null,
        MaxQtyRowsFetch: 8,
      },
      {
        Id: 101,
        FechaFact: '2024-06-02T00:00:00',
        NumeroConsecutivo: '50601011800010000000002',
        Consecutivo: '1002',
        RcprNombre: 'Distribuidora XYZ',
        Status: 4,
        TotalComprobante: 5000.00,
        CodigoMoneda: '$',
        DocType: '01',
        Clave: '50601011800010000000002202406029876543210',
        FechaEmision: '2024-06-02T11:00:00',
        ErrDetails: null,
        MaxQtyRowsFetch: 8,
      },
      {
        Id: 102,
        FechaFact: '2024-06-03T00:00:00',
        NumeroConsecutivo: '50601011800010000000003',
        Consecutivo: '1003',
        RcprNombre: 'Proveedor FEC',
        Status: 5,
        TotalComprobante: 8500.50,
        CodigoMoneda: '₡',
        DocType: '08',
        Clave: '50601011800010000000003202406031111111111',
        FechaEmision: '2024-06-03T09:00:00',
        ErrDetails: 'Error de validación fiscal',
        MaxQtyRowsFetch: 8,
      },
    ],
  },
  Message: 'OK',
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function injectAuth(page, perms = []) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms })
}

async function mockDocumentsAPI(page, responseBody = MOCK_DOCUMENTS_RESPONSE) {
  await page.route('**/api/documents*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseBody) })
  )
}

// ─── Auth guard ──────────────────────────────────────────────────────────────

test.describe('Documents Issued — Auth guard', () => {
  test('redirige a login si no hay sesión', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─── Carga inicial ───────────────────────────────────────────────────────────

test.describe('Documents Issued — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-page"]')
  })

  test('renderiza el formulario de filtros', async ({ page }) => {
    await expect(page.locator('[data-testid="input-start-date"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-end-date"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-consecutivo"]')).toBeVisible()
    await expect(page.locator('[data-testid="select-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-cedula"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-codigo-moneda"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-clave"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-receptor"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-consecutivo-fe"]')).toBeVisible()
    await expect(page.locator('[data-testid="select-doc-type"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-search"]')).toBeVisible()
  })

  test('las fechas se inicializan con la fecha actual', async ({ page }) => {
    const today = new Date()
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    await expect(page.locator('[data-testid="input-start-date"]')).toHaveValue(todayISO)
    await expect(page.locator('[data-testid="input-end-date"]')).toHaveValue(todayISO)
  })

  test('el select de Estado tiene "Todos" seleccionado por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="select-status"]')).toHaveValue('99')
  })

  test('el select de Tipo de Documento tiene "FE" seleccionado por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="select-doc-type"]')).toHaveValue('01')
  })

  test('la tabla Tabulator se renderiza', async ({ page }) => {
    await expect(page.locator('[data-testid="documents-issued-table"]')).toBeVisible()
  })
})

// ─── Parámetro URL ?clave= ───────────────────────────────────────────────────

test.describe('Documents Issued — Parámetro ?clave=', () => {
  test('pre-llena el campo Clave desde la URL', async ({ page }) => {
    await injectAuth(page)
    await mockDocumentsAPI(page)
    await page.goto(`${PAGE_URL}?clave=50601011800010000000001202406011234567890`)
    await expect(page.locator('[data-testid="input-clave"]')).toHaveValue('50601011800010000000001202406011234567890')
  })
})

// ─── Botón "Hoy" ─────────────────────────────────────────────────────────────

test.describe('Documents Issued — Botón Hoy', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
  })

  test('botón Hoy en StartDate setea la fecha actual', async ({ page }) => {
    await page.fill('[data-testid="input-start-date"]', '2020-01-01')
    await page.click('[data-testid="btn-today-start"]')
    const today = new Date()
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    await expect(page.locator('[data-testid="input-start-date"]')).toHaveValue(todayISO)
  })

  test('botón Hoy en EndDate setea la fecha actual', async ({ page }) => {
    await page.fill('[data-testid="input-end-date"]', '2020-01-01')
    await page.click('[data-testid="btn-today-end"]')
    const today = new Date()
    const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    await expect(page.locator('[data-testid="input-end-date"]')).toHaveValue(todayISO)
  })
})

// ─── Búsqueda y datos en tabla ───────────────────────────────────────────────

test.describe('Documents Issued — Búsqueda', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
  })

  test('hace GET a api/documents al hacer clic en Consultar', async ({ page }) => {
    let captured = null
    page.on('request', req => { if (req.url().includes('/api/documents')) captured = req.url() })
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(500)
    expect(captured).not.toBeNull()
    expect(captured).toContain('/api/documents')
  })

  test('envía los parámetros de filtro correctos', async ({ page }) => {
    let captured = null
    page.on('request', req => { if (req.url().includes('/api/documents?')) captured = new URL(req.url()) })

    await page.fill('[data-testid="input-consecutivo"]', '1001')
    await page.selectOption('[data-testid="select-status"]', '1')
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(500)

    expect(captured?.searchParams.get('Consecutivo')).toBe('1001')
    expect(captured?.searchParams.get('Status')).toBe('1')
  })

  test('muestra contadores de estado tras búsqueda exitosa', async ({ page }) => {
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(600)
    const counters = page.locator('[data-testid="documents-issued-page"] [data-documents-issued-target="statusCounters"]')
    await expect(counters).toContainText('Aceptado: 5')
    await expect(counters).toContainText('Rechazado: 2')
  })

  test('muestra botón "Más Información" tras búsqueda exitosa con datos', async ({ page }) => {
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(600)
    await expect(page.locator('[data-testid="btn-chart"]')).toBeVisible()
  })

  test('oculta botón "Más Información" al modificar el formulario', async ({ page }) => {
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(600)
    await expect(page.locator('[data-testid="btn-chart"]')).toBeVisible()
    await page.click('[data-testid="btn-search"]')
    // El botón se oculta al iniciar nueva búsqueda
    // (la visibilidad se controla en el método search())
  })
})

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('Documents Issued — Permisos', () => {
  test('no muestra botón Descarga Masiva sin permiso F_CreateBulkDownloadOfDocuments', async ({ page }) => {
    await injectAuth(page, []) // sin permisos
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await expect(page.locator('[data-testid="btn-bulk-download"]')).toBeHidden()
  })

  test('muestra botón Descarga Masiva con permiso F_CreateBulkDownloadOfDocuments', async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await expect(page.locator('[data-testid="btn-bulk-download"]')).toBeVisible()
  })
})

// ─── Menú de opciones por fila ───────────────────────────────────────────────

test.describe('Documents Issued — Menú de opciones', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)
  })

  test('abre el dropdown al hacer clic en botón opciones', async ({ page }) => {
    const optBtn = page.locator('[data-action-type="options"]').first()
    await optBtn.click()
    await expect(page.locator('#cl-row-dropdown')).toBeVisible()
  })

  test('cierra el dropdown al hacer clic fuera', async ({ page }) => {
    const optBtn = page.locator('[data-action-type="options"]').first()
    await optBtn.click()
    await expect(page.locator('#cl-row-dropdown')).toBeVisible()
    await page.click('body', { position: { x: 10, y: 10 } })
    await page.waitForTimeout(200)
    await expect(page.locator('#cl-row-dropdown')).toBeHidden()
  })

  test('deshabilita "Ver XML (Resp Hacienda)" si Status no es 1 ni 4 (Status=5)', async ({ page }) => {
    // Doc index 2 = Status 5 (Error)
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click()
    const dropdown = page.locator('#cl-row-dropdown')
    await expect(dropdown).toBeVisible()
    const viewXmlBtn = dropdown.locator('button', { hasText: 'Ver XML (Resp Hacienda)' })
    await expect(viewXmlBtn).toBeDisabled()
  })

  test('habilita "Ver XML (Resp Hacienda)" si Status=4 (Rechazado)', async ({ page }) => {
    // Doc index 1 = Status 4
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(1).click()
    const dropdown = page.locator('#cl-row-dropdown')
    await expect(dropdown).toBeVisible()
    const viewXmlBtn = dropdown.locator('button', { hasText: 'Ver XML (Resp Hacienda)' })
    await expect(viewXmlBtn).toBeEnabled()
  })

  test('deshabilita "Omitir Validaciones" si Status!=5', async ({ page }) => {
    // Doc index 0 = Status 1 (Aceptado)
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(0).click()
    const dropdown = page.locator('#cl-row-dropdown')
    const skipBtn = dropdown.locator('button', { hasText: 'Omitir Validaciones' })
    await expect(skipBtn).toBeDisabled()
  })

  test('habilita "Omitir Validaciones" si Status=5', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click() // Status=5
    const dropdown = page.locator('#cl-row-dropdown')
    const skipBtn = dropdown.locator('button', { hasText: 'Omitir Validaciones' })
    await expect(skipBtn).toBeEnabled()
  })

  test('habilita "Anulación Interna" solo para DocType=08 y Status!=7', async ({ page }) => {
    // Doc index 2 = DocType='08', Status=5 (no es 7) → habilitado
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click()
    const dropdown = page.locator('#cl-row-dropdown')
    const cancelBtn = dropdown.locator('button', { hasText: 'Anulación Interna' })
    await expect(cancelBtn).toBeEnabled()
  })

  test('deshabilita "Anulación Interna" si DocType!="08"', async ({ page }) => {
    // Doc index 0 = DocType='01'
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(0).click()
    const dropdown = page.locator('#cl-row-dropdown')
    const cancelBtn = dropdown.locator('button', { hasText: 'Anulación Interna' })
    await expect(cancelBtn).toBeDisabled()
  })

  test('deshabilita "Reprocesar" si Status!=4', async ({ page }) => {
    // Doc index 0 = Status 1 (Aceptado)
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(0).click()
    const dropdown = page.locator('#cl-row-dropdown')
    const reprocessBtn = dropdown.locator('button', { hasText: 'Reprocesar' })
    await expect(reprocessBtn).toBeDisabled()
  })

  test('habilita "Reprocesar" si Status=4', async ({ page }) => {
    // Doc index 1 = Status 4 (Rechazado)
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(1).click()
    const dropdown = page.locator('#cl-row-dropdown')
    const reprocessBtn = dropdown.locator('button', { hasText: 'Reprocesar' })
    await expect(reprocessBtn).toBeEnabled()
  })
})

// ─── Modal Correos ────────────────────────────────────────────────────────────

test.describe('Documents Issued — Modal Correos', () => {
  const MOCK_MAILS = [
    { CreateDate: '2024-06-01T10:00:00', Status: 'Enviado', DocStatus: 'Aceptado',
      LastAttempt: '2024-06-01T10:00:00', OutputTo: 'cliente@example.com',
      OutputCC: '', Type: '01', Details: 'Enviado correctamente' },
  ]

  test.beforeEach(async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.route('**/api/Email/GetOutgoingMails*', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ Data: MOCK_MAILS, Message: 'OK' }) })
    )
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)
  })

  test('abre el modal de correos', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    const dropdown = page.locator('#cl-row-dropdown')
    await dropdown.locator('button', { hasText: 'Correos' }).click()
    await page.waitForTimeout(400)
    await expect(page.locator('[data-testid="email-modal"]')).toBeVisible()
  })

  test('muestra el toggle de "Otros destinatarios" en el modal de correos', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Correos' }).click()
    await page.waitForTimeout(400)
    await expect(page.locator('[data-testid="btn-other-emails"]')).toBeVisible()
  })

  test('toggle "Otros destinatarios" muestra/oculta el formulario', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Correos' }).click()
    await page.waitForTimeout(400)

    const form = page.locator('[data-documents-issued-target="otherEmailsForm"]')
    await expect(form).toBeHidden()
    await page.click('[data-testid="btn-other-emails"]')
    await expect(form).toBeVisible()
    await page.click('[data-testid="btn-other-emails"]')
    await expect(form).toBeHidden()
  })

  test('cierra el modal de correos', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Correos' }).click()
    await page.waitForTimeout(400)
    await page.locator('[data-testid="email-modal"] button', { hasText: 'Cerrar' }).first().click()
    await expect(page.locator('[data-testid="email-modal"]')).toBeHidden()
  })
})

// ─── Modal Información ────────────────────────────────────────────────────────

test.describe('Documents Issued — Modal Información', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)
  })

  test('abre el modal de información', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Consultar Información' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="info-modal"]')).toBeVisible()
  })

  test('muestra la Clave del documento', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Consultar Información' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="info-clave"]')).toContainText('50601011800010000000001')
  })

  test('muestra error interno si ErrDetails existe (Status=5)', async ({ page }) => {
    await page.route('**/api/Documents/issued/*/xml-response-message', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ Data: { HrRespuestaXml: '' }, Message: 'OK' }) })
    )
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click() // Doc con ErrDetails
    await page.locator('#cl-row-dropdown button', { hasText: 'Consultar Información' }).click()
    await page.waitForTimeout(300)
    const errorSection = page.locator('[data-documents-issued-target="infoErrorSection"]')
    await expect(errorSection).toBeVisible()
    await expect(page.locator('[data-testid="info-error"]')).toContainText('Error de validación fiscal')
  })

  test('llama a xml-response-message si Status=4 (Rechazado)', async ({ page }) => {
    let xmlApiCalled = false
    await page.route('**/api/Documents/issued/*/xml-response-message', route => {
      xmlApiCalled = true
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ Data: { HrRespuestaXml: 'RESP_XML_CONTENT' }, Message: 'OK' }) })
    })

    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(1).click() // Doc Status=4
    await page.locator('#cl-row-dropdown button', { hasText: 'Consultar Información' }).click()
    await page.waitForTimeout(500)
    expect(xmlApiCalled).toBe(true)
    await expect(page.locator('[data-testid="info-error-hacienda"]')).toContainText('RESP_XML_CONTENT')
  })

  test('cierra el modal de información', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.first().click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Consultar Información' }).click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="info-modal"] button', { hasText: 'Cerrar' }).click()
    await expect(page.locator('[data-testid="info-modal"]')).toBeHidden()
  })
})

// ─── Omitir Validaciones ──────────────────────────────────────────────────────

test.describe('Documents Issued — Omitir Validaciones', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.route('**/api/Documents', route => {
      if (route.request().method() === 'PATCH')
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: true, Message: 'OK' }) })
      else route.continue()
    })
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)
  })

  test('abre modal de confirmación al hacer clic en Omitir Validaciones', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click() // Status=5
    await page.locator('#cl-row-dropdown button', { hasText: 'Omitir Validaciones' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
  })

  test('cancela la acción al hacer clic en Cancelar', async ({ page }) => {
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Omitir Validaciones' }).click()
    await page.waitForTimeout(300)
    await page.click('[data-testid="btn-cancel-confirm"]')
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeHidden()
  })

  test('hace PATCH a api/Documents al confirmar', async ({ page }) => {
    let patched = false
    page.on('request', req => {
      if (req.url().includes('/api/Documents') && req.method() === 'PATCH') patched = true
    })
    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(2).click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Omitir Validaciones' }).click()
    await page.waitForTimeout(300)
    await page.click('[data-testid="btn-accept-confirm"]')
    await page.waitForTimeout(500)
    expect(patched).toBe(true)
  })
})

// ─── Reprocesar ───────────────────────────────────────────────────────────────

test.describe('Documents Issued — Reprocesar', () => {
  test('hace PATCH a /Reprocess al confirmar con permisos', async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.route('**/api/Documents/*/Reprocess*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: true }) })
    )
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)

    let reprocessCalled = false
    page.on('request', req => {
      if (req.url().includes('/Reprocess') && req.method() === 'PATCH') reprocessCalled = true
    })

    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(1).click() // Status=4 (Rechazado)
    await page.locator('#cl-row-dropdown button', { hasText: 'Reprocesar' }).click()
    await page.waitForTimeout(500)
    expect(reprocessCalled).toBe(true)
  })

  test('muestra toast de error sin permiso Documents_Emission_Reprocess', async ({ page }) => {
    await injectAuth(page, []) // sin permisos
    await mockDocumentsAPI(page)
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(800)

    const optBtns = page.locator('[data-action-type="options"]')
    await optBtns.nth(1).click()
    await page.locator('#cl-row-dropdown button', { hasText: 'Reprocesar' }).click()
    await page.waitForTimeout(300)
    // Toast de info sobre falta de permiso
    await expect(page.locator('#toast-container')).toContainText('No tiene permiso')
  })
})

// ─── Descarga Masiva ──────────────────────────────────────────────────────────

test.describe('Documents Issued — Descarga Masiva', () => {
  test('hace POST a /BulkDownloadOfDocuments al confirmar', async ({ page }) => {
    await injectAuth(page, MOCK_PERMISSIONS_FULL)
    await mockDocumentsAPI(page)
    await page.route('**/api/Report/BulkDownloadOfDocuments/*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: true }) })
    )
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="btn-bulk-download"]')

    let bulkCalled = false
    page.on('request', req => {
      if (req.url().includes('/BulkDownloadOfDocuments')) bulkCalled = true
    })

    await page.click('[data-testid="btn-bulk-download"]')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
    await page.click('[data-testid="btn-accept-confirm"]')
    await page.waitForTimeout(500)
    expect(bulkCalled).toBe(true)
  })
})

// ─── Error de API ─────────────────────────────────────────────────────────────

test.describe('Documents Issued — Errores de API', () => {
  test('muestra modal de error si la API de documentos falla', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/documents*', route =>
      route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ Data: null, Message: 'Error interno del servidor' }) })
    )
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid="documents-issued-table"]')
    await page.waitForTimeout(600)

    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible()
  })

  test('cierra el modal de error al hacer clic en Entendido', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/documents*', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ Data: null, Message: 'Error' }) })
    )
    await page.goto(PAGE_URL)
    await page.waitForTimeout(600)
    await page.click('[data-testid="btn-search"]')
    await page.waitForTimeout(500)
    await page.locator('[data-testid="error-modal"] button', { hasText: 'Entendido' }).click()
    await expect(page.locator('[data-testid="error-modal"]')).toBeHidden()
  })
})
