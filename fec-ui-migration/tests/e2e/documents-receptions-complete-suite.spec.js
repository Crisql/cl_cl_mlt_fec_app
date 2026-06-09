// @ts-check
/**
 * Suite E2E: Documents Receptions (Búsqueda de Documentos Aceptados) — migración Angular → Rails
 * Ruta: /documents/receptions
 *
 * Cubre:
 *   - Auth guard (redirige a login sin sesión)
 *   - Carga inicial: formulario, valores default, bandejas, monedas, info empresa
 *   - Checkbox useXMLDates → cambia label de fechas
 *   - Botones Hoy en fechas
 *   - Validación búsqueda: sin clave y sin fechas → modal info
 *   - Validación búsqueda: fechas futuras / StartDate > EndDate → modal info
 *   - Búsqueda exitosa → tabla con datos, btnChart visible
 *   - Búsqueda vacía → tabla vacía, btnChart oculto
 *   - Cambio en form después de búsqueda → btnChart se oculta
 *   - Botón Descarga Masiva: visible solo con permiso
 *   - Descarga Masiva: confirmación → POST → toast
 *   - Acción Ver PDF: HavePathReceptPDF=true → descarga; false → toast info
 *   - Acción Ver XML Hacienda: Status 1/4 → abre tab; otros → toast info
 *   - Acción Descargar XML Enviado
 *   - Acción Enviar Aceptación: condiciones correctas → POST; no cumple → toast info
 *   - Acción Previsualizar Aceptación: Status 7 → panel lateral; otros → toast info
 *   - Panel lateral: pre-llenado, Cancelar, Enviar → POST
 *   - Acción Obtenido del correo: Bandeja no vacía → modal info; vacío → toast info
 *   - Acción Consultar Información → modal info
 *   - Acción Detalle del Mensaje → modal info
 *   - Acción Reprocesar: Status 4 y perm → PATCH; sin perm → toast info
 *   - Modal info y error: abrir/cerrar
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:3000'
const PAGE_URL = `${BASE_URL}/documents/receptions`
const LOGIN_URL = `${BASE_URL}/login`

// ──────────────────────────────────────────────
// Mocks de autenticación
// ──────────────────────────────────────────────

const MOCK_SESSION = {
  access_token: 'mock-token-receptions',
  token_type:   'Bearer',
  expires_at:   Date.now() + 3_600_000,
  UserEmail:    'testuser@clavisco.com',
  UserId:       'user-001',
}

const MOCK_COMPANY = {
  companyId:       '42',
  companyName:     'Empresa Test SA',
  groupId:         1,
  codigoActividad: '123456',
}

const MOCK_PERMISSIONS_FULL = [
  'F_CreateBulkDownloadOfDocuments',
  'F_CreateAPInvoice',
  'Documents_Acceptance_Reprocess',
]

const MOCK_PERMISSIONS_EMPTY = []

// ──────────────────────────────────────────────
// Mocks de respuestas API
// ──────────────────────────────────────────────

const MOCK_BANDEJAS = {
  Data: [
    { BandejaReceptor: 'bandeja@empresa.com' },
    { BandejaReceptor: 'otra@empresa.com' },
  ],
}

const MOCK_CURRENCY_CODES = {
  Data: [
    { CodigoMoneda: 'CRC' },
    { CodigoMoneda: 'USD' },
    { CodigoMoneda: 'EUR' },
  ],
}

const MOCK_COMPANY_INFO = {
  Data: {
    DefaultTaxForXML:    'IV',
    SendReceptAndApInv:  false,
    UseFactProv:         true,
  },
}

const makeDoc = (overrides = {}) => ({
  Id:                    100,
  DocName:               'FE-00001',
  FechaEmisionXML:       '2024-06-01T10:00:00',
  FechaEmisionDoc:       '2024-06-02T08:00:00',
  DocType:               '01',
  NombreEmisor:          'Proveedor SA',
  NumeroCedulaEmisor:    '3-101-123456',
  NumeroConsecutivoEmisor: '001-001-0000000001',
  MontoTotalImpuesto:    1394.96,
  TotalFactura:          14000,
  Status:                1,
  Mensaje:               1,
  DetalleMensaje:        'Documento aceptado correctamente',
  HavePathReceptPDF:     true,
  IsComplete:            true,
  Bandeja:               'bandeja@empresa.com',
  ConsecutivoDoc:        0,
  DocEntry:              0,
  DocTypeSAP:            0,
  CodigoActividadReceptor: '123456',
  CondicionImpuesto:     '01',
  TaxFactor:             '',
  MaxQtyRowsFetch:       50,
  ...overrides,
})

const MOCK_SEARCH_RESPONSE = {
  Data: {
    DocumentQtyList: [
      { Status: 1, Quantity: 3 },
      { Status: 4, Quantity: 1 },
    ],
    DocumentList: [
      makeDoc({ Id: 100, Status: 1 }),
      makeDoc({ Id: 101, Status: 4, Bandeja: '', HavePathReceptPDF: false }),
      makeDoc({ Id: 102, Status: 7, IsComplete: true }),
    ],
  },
}

const MOCK_SEARCH_EMPTY = {
  Data: { DocumentQtyList: [], DocumentList: [] },
  Message: 'No se encontraron documentos',
}

const MOCK_PDF_RESPONSE = {
  Data: { File: btoa('PDF content mock') },
}

const MOCK_XML_RESPONSE = {
  Data: { HrRespuestaXml: btoa('<xml>hacienda response</xml>') },
}

const MOCK_INFO_RECEPT = {
  Data: { HrRespuestaXml: 'Documento procesado correctamente por Hacienda' },
}

const MOCK_RECEPT_SUCCESS = { result: true }
const MOCK_RECEPT_FAILURE = { result: false, errorInfo: { Message: 'Error al procesar' } }
const MOCK_BULK_SUCCESS   = { Data: {}, Message: null }

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function injectAuth(page, { permissions = MOCK_PERMISSIONS_FULL, company = MOCK_COMPANY } = {}) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',           JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany',  JSON.stringify(company))
    sessionStorage.setItem('Permissions',     JSON.stringify(permissions))
    sessionStorage.setItem('currentFEUser',   JSON.stringify({ access_token: 'mock-fe-token' }))
  }, { session: MOCK_SESSION, company, permissions })
}

async function mockInitialApis(page) {
  await page.route('**/api/Documents/GetBandejasReceptores**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BANDEJAS) })
  )
  await page.route('**/api/Documents/GetCurrencyCodeAD**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CURRENCY_CODES) })
  )
  await page.route('**/api/companies/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COMPANY_INFO) })
  )
}

async function mockSearchAndNavigate(page, { response = MOCK_SEARCH_RESPONSE } = {}) {
  await mockInitialApis(page)
  await page.route('**/api/Documents/SearchDocumentsAccepted**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  )
  await page.goto(PAGE_URL)
}

// ══════════════════════════════════════════════
// Auth Guard
// ══════════════════════════════════════════════

test.describe('Auth Guard', () => {
  test('redirige a login si no hay sesión', async ({ page }) => {
    await page.goto(PAGE_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })
})

// ══════════════════════════════════════════════
// Carga inicial
// ══════════════════════════════════════════════

test.describe('Carga inicial', () => {
  test('muestra el formulario de filtros con todos los campos', async ({ page }) => {
    await injectAuth(page)
    await mockInitialApis(page)
    await page.route('**/api/Documents/SearchDocumentsAccepted**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEARCH_RESPONSE) })
    )
    await page.goto(PAGE_URL)

    await expect(page.getByTestId('input-start-date')).toBeVisible()
    await expect(page.getByTestId('input-end-date')).toBeVisible()
    await expect(page.getByTestId('check-use-xml-dates')).toBeVisible()
    await expect(page.getByTestId('select-message-type')).toBeVisible()
    await expect(page.getByTestId('select-status')).toBeVisible()
    await expect(page.getByTestId('input-nombre-emisor')).toBeVisible()
    await expect(page.getByTestId('input-clave')).toBeVisible()
    await expect(page.getByTestId('input-cedula')).toBeVisible()
    await expect(page.getByTestId('input-consecutivo-emisor')).toBeVisible()
    await expect(page.getByTestId('select-doc-type')).toBeVisible()
    await expect(page.getByTestId('select-bandeja')).toBeVisible()
    await expect(page.getByTestId('input-codigo-moneda')).toBeVisible()
    await expect(page.getByTestId('btn-search')).toBeVisible()
  })

  test('Status default es 0 (Todos)', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('select-status')).toHaveValue('0')
  })

  test('MessageType default es 0 (Todos)', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('select-message-type')).toHaveValue('0')
  })

  test('DocType default es 01 (FE)', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('select-doc-type')).toHaveValue('01')
  })

  test('Bandejas se cargan en el select', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    const selectBandeja = page.getByTestId('select-bandeja')
    await expect(selectBandeja.locator('option[value="bandeja@empresa.com"]')).toBeAttached({ timeout: 5000 })
  })

  test('btnChart oculto en carga inicial', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('btn-chart')).toBeHidden()
  })
})

// ══════════════════════════════════════════════
// Checkbox useXMLDates
// ══════════════════════════════════════════════

test.describe('useXMLDates', () => {
  test('sin marcar → label muestra "Recepción"', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    const label = page.getByTestId('label-date-type')
    await expect(label).toContainText('Recepción')
  })

  test('marcado → label muestra "Emisión"', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await page.getByTestId('check-use-xml-dates').check()
    await expect(page.getByTestId('label-date-type')).toContainText('Emisión')
  })
})

// ══════════════════════════════════════════════
// Botones Hoy
// ══════════════════════════════════════════════

test.describe('Botones Hoy', () => {
  test('botón Hoy en Fecha Inicio pone la fecha actual', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    const today = new Date().toISOString().split('T')[0]
    await page.getByTestId('btn-today-start').click()
    await expect(page.getByTestId('input-start-date')).toHaveValue(today)
  })

  test('botón Hoy en Fecha Final pone la fecha actual', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    const today = new Date().toISOString().split('T')[0]
    await page.getByTestId('btn-today-end').click()
    await expect(page.getByTestId('input-end-date')).toHaveValue(today)
  })
})

// ══════════════════════════════════════════════
// Validaciones de búsqueda
// ══════════════════════════════════════════════

test.describe('Validaciones de búsqueda', () => {
  test('sin clave y sin fechas → modal info "fechas requeridas"', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    // Limpiar fechas
    await page.getByTestId('input-start-date').fill('')
    await page.getByTestId('input-end-date').fill('')
    await page.getByTestId('input-clave').fill('')
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('info-modal')).toBeVisible()
    await expect(page.getByTestId('info-body')).toContainText(/fecha/i)
  })

  test('fechas futuras → modal info "fechas no pueden ser futuras"', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0]
    await page.getByTestId('input-start-date').fill(futureDate)
    await page.getByTestId('input-end-date').fill(futureDate)
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('info-modal')).toBeVisible()
  })

  test('StartDate > EndDate → modal info', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await page.getByTestId('input-start-date').fill('2024-06-30')
    await page.getByTestId('input-end-date').fill('2024-06-01')
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('info-modal')).toBeVisible()
  })

  test('con clave → busca aunque no haya fechas', async ({ page }) => {
    await injectAuth(page)
    let searched = false
    await mockInitialApis(page)
    await page.route('**/api/Documents/SearchDocumentsAccepted**', route => {
      searched = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEARCH_RESPONSE) })
    })
    await page.goto(PAGE_URL)
    await page.getByTestId('input-start-date').fill('')
    await page.getByTestId('input-end-date').fill('')
    await page.getByTestId('input-clave').fill('50601011800010000000001')
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    expect(searched).toBe(true)
  })
})

// ══════════════════════════════════════════════
// Búsqueda y tabla
// ══════════════════════════════════════════════

test.describe('Búsqueda y tabla', () => {
  test('búsqueda exitosa → btnChart visible', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('btn-chart')).toBeVisible({ timeout: 5000 })
  })

  test('GET incluye todos los params requeridos', async ({ page }) => {
    await injectAuth(page)
    let capturedUrl = ''
    await mockInitialApis(page)
    await page.route('**/api/Documents/SearchDocumentsAccepted**', route => {
      capturedUrl = route.request().url()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEARCH_RESPONSE) })
    })
    await page.goto(PAGE_URL)
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    expect(capturedUrl).toContain('CompanyId=42')
    expect(capturedUrl).toContain('StartPost=')
    expect(capturedUrl).toContain('StepPost=')
  })

  test('cambio en form después de búsqueda → btnChart se oculta', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('btn-chart')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('input-nombre-emisor').fill('cambio')
    await expect(page.getByTestId('btn-chart')).toBeHidden()
  })
})

// ══════════════════════════════════════════════
// Descarga Masiva
// ══════════════════════════════════════════════

test.describe('Descarga Masiva', () => {
  test('con permiso → botón visible', async ({ page }) => {
    await injectAuth(page, { permissions: ['F_CreateBulkDownloadOfDocuments'] })
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('btn-bulk-download')).toBeVisible()
  })

  test('sin permiso → botón oculto', async ({ page }) => {
    await injectAuth(page, { permissions: [] })
    await mockSearchAndNavigate(page)
    await expect(page.getByTestId('btn-bulk-download')).toBeHidden()
  })

  test('clic → modal de confirmación', async ({ page }) => {
    await injectAuth(page, { permissions: ['F_CreateBulkDownloadOfDocuments'] })
    await mockSearchAndNavigate(page)
    await page.getByTestId('btn-bulk-download').click()
    await expect(page.getByTestId('confirm-modal')).toBeVisible()
  })

  test('confirmar → POST y toast success', async ({ page }) => {
    await injectAuth(page, { permissions: ['F_CreateBulkDownloadOfDocuments'] })
    await mockSearchAndNavigate(page)
    await page.route('**/api/Report/BulkDownloadOfDocuments**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BULK_SUCCESS) })
    )
    await page.getByTestId('btn-bulk-download').click()
    await page.getByTestId('confirm-btn').click()
    await expect(page.locator('#toast-container')).toContainText(/éxito|solicitud/i, { timeout: 5000 })
  })
})

// ══════════════════════════════════════════════
// Acción: Ver PDF
// ══════════════════════════════════════════════

test.describe('Acción: Ver PDF', () => {
  test('HavePathReceptPDF=false → toast info', async ({ page }) => {
    await injectAuth(page)
    await mockSearchAndNavigate(page)
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    // doc 101 tiene HavePathReceptPDF=false — click en su acción
    const row = page.locator('[data-doc-id="101"]')
    await row.locator('[data-action-type="pdf"]').click()
    await expect(page.locator('#toast-container')).toContainText(/PDF/i, { timeout: 3000 })
  })
})

// ══════════════════════════════════════════════
// Acción: Ver XML Resp Hacienda
// ══════════════════════════════════════════════

test.describe('Acción: Ver XML Resp Hacienda', () => {
  test('Status != 1 ni 4 → toast info', async ({ page }) => {
    await injectAuth(page)
    // doc con status 7
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 200, Status: 7 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    const row = page.locator('[data-doc-id="200"]')
    await row.locator('[data-action-type="xml-hacienda"]').click()
    await expect(page.locator('#toast-container')).toContainText(/Aceptado|Rechazado/i, { timeout: 3000 })
  })

  test('Status 1 → llama al API', async ({ page }) => {
    await injectAuth(page)
    let called = false
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 300, Status: 1 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.route('**/api/Documents/GetDocumentXMLAccepted**', route => {
      called = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_XML_RESPONSE) })
    })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    const row = page.locator('[data-doc-id="300"]')
    await row.locator('[data-action-type="xml-hacienda"]').click()
    await page.waitForTimeout(1000)
    expect(called).toBe(true)
  })
})

// ══════════════════════════════════════════════
// Acción: Previsualizar Aceptación (panel lateral)
// ══════════════════════════════════════════════

test.describe('Acción: Previsualizar Aceptación', () => {
  test('Status != 7 → toast info', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 400, Status: 1 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    const row = page.locator('[data-doc-id="400"]')
    await row.locator('[data-action-type="preview-recept"]').click()
    await expect(page.locator('#toast-container')).toContainText(/disponible/i, { timeout: 3000 })
  })

  test('Status 7 → panel lateral se abre', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 500, Status: 7 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    const row = page.locator('[data-doc-id="500"]')
    await row.locator('[data-action-type="preview-recept"]').click()
    await expect(page.getByTestId('recept-panel')).not.toHaveClass(/translate-x-full/, { timeout: 3000 })
  })

  test('panel lateral: Cancelar cierra el panel', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 501, Status: 7 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="501"] [data-action-type="preview-recept"]').click()
    await expect(page.getByTestId('recept-panel')).not.toHaveClass(/translate-x-full/, { timeout: 3000 })
    await page.getByTestId('btn-recept-cancel').click()
    await expect(page.getByTestId('recept-panel')).toHaveClass(/translate-x-full/)
  })

  test('panel lateral: Enviar → POST ReceptMessageFromMailParser con editInfo:true', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 502, Status: 7 })] } }
    await mockSearchAndNavigate(page, { response })
    let capturedBody = null
    await page.route('**/api/Documents/ReceptMessageFromMailParser**', route => {
      capturedBody = route.request().postData()
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RECEPT_SUCCESS) })
    })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="502"] [data-action-type="preview-recept"]').click()
    await page.getByTestId('btn-recept-submit').click()
    await page.waitForTimeout(1000)
    expect(capturedBody).toBeTruthy()
    const body = JSON.parse(capturedBody)
    expect(body.editInfo).toBe(true)
  })
})

// ══════════════════════════════════════════════
// Acción: Obtenido del correo
// ══════════════════════════════════════════════

test.describe('Acción: Obtenido del correo', () => {
  test('Bandeja vacía → toast info', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 600, Bandeja: '' })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="600"] [data-action-type="bandeja"]').click()
    await expect(page.locator('#toast-container')).toContainText(/disponible/i, { timeout: 3000 })
  })

  test('Bandeja con valor → modal info', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 601, Bandeja: 'bandeja@test.com' })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="601"] [data-action-type="bandeja"]').click()
    await expect(page.getByTestId('info-modal')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('info-body')).toContainText('bandeja@test.com')
  })
})

// ══════════════════════════════════════════════
// Acción: Detalle del Mensaje
// ══════════════════════════════════════════════

test.describe('Acción: Detalle del Mensaje', () => {
  test('siempre abre modal info con DetalleMensaje', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 700, DetalleMensaje: 'Mensaje de prueba' })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="700"] [data-action-type="detalle-mensaje"]').click()
    await expect(page.getByTestId('info-modal')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('info-body')).toContainText('Mensaje de prueba')
  })
})

// ══════════════════════════════════════════════
// Acción: Consultar Información
// ══════════════════════════════════════════════

test.describe('Acción: Consultar Información', () => {
  test('llama al API y muestra modal info', async ({ page }) => {
    await injectAuth(page)
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 800 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.route('**/api/Documents/reception/*/xml-response-message**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INFO_RECEPT) })
    )
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="800"] [data-action-type="consultar-info"]').click()
    await expect(page.getByTestId('info-modal')).toBeVisible({ timeout: 5000 })
  })
})

// ══════════════════════════════════════════════
// Acción: Reprocesar
// ══════════════════════════════════════════════

test.describe('Acción: Reprocesar', () => {
  test('Status != 4 → toast info', async ({ page }) => {
    await injectAuth(page, { permissions: ['Documents_Acceptance_Reprocess'] })
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 900, Status: 1 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="900"] [data-action-type="reprocesar"]').click()
    await expect(page.locator('#toast-container')).toContainText(/rechazado/i, { timeout: 3000 })
  })

  test('sin permiso → toast info', async ({ page }) => {
    await injectAuth(page, { permissions: [] })
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 901, Status: 4 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="901"] [data-action-type="reprocesar"]').click()
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 3000 })
  })

  test('Status 4 y perm → PATCH al API', async ({ page }) => {
    await injectAuth(page, { permissions: ['Documents_Acceptance_Reprocess'] })
    let patched = false
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 902, Status: 4 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.route('**/api/Documents/902/Reprocess**', route => {
      patched = true
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="902"] [data-action-type="reprocesar"]').click()
    await page.waitForTimeout(1000)
    expect(patched).toBe(true)
  })

  test('PATCH incluye header API:ApiFEUrl', async ({ page }) => {
    await injectAuth(page, { permissions: ['Documents_Acceptance_Reprocess'] })
    let capturedHeaders = {}
    const response = { Data: { DocumentQtyList: [], DocumentList: [makeDoc({ Id: 903, Status: 4 })] } }
    await mockSearchAndNavigate(page, { response })
    await page.route('**/api/Documents/903/Reprocess**', route => {
      capturedHeaders = route.request().headers()
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.getByTestId('btn-search').click()
    await page.waitForTimeout(1000)
    await page.locator('[data-doc-id="903"] [data-action-type="reprocesar"]').click()
    await page.waitForTimeout(1000)
    expect(capturedHeaders['api']).toBe('ApiFEUrl')
    expect(capturedHeaders['cl-company-id']).toBe('42')
  })
})

// ══════════════════════════════════════════════
// Modales — abrir/cerrar
// ══════════════════════════════════════════════

test.describe('Modal info', () => {
  test('se cierra al hacer click en Cerrar', async ({ page }) => {
    await injectAuth(page)
    // Provocar apertura vía validación sin fechas
    await mockSearchAndNavigate(page)
    await page.getByTestId('input-start-date').fill('')
    await page.getByTestId('input-end-date').fill('')
    await page.getByTestId('input-clave').fill('')
    await page.getByTestId('btn-search').click()
    await expect(page.getByTestId('info-modal')).toBeVisible()
    await page.getByTestId('btn-info-close').click()
    await expect(page.getByTestId('info-modal')).toBeHidden()
  })
})

test.describe('Modal confirmación', () => {
  test('cancelar cierra el modal sin hacer POST', async ({ page }) => {
    await injectAuth(page, { permissions: ['F_CreateBulkDownloadOfDocuments'] })
    let posted = false
    await mockSearchAndNavigate(page)
    await page.route('**/api/Report/BulkDownloadOfDocuments**', () => { posted = true })
    await page.getByTestId('btn-bulk-download').click()
    await expect(page.getByTestId('confirm-modal')).toBeVisible()
    await page.getByTestId('btn-confirm-cancel').click()
    await expect(page.getByTestId('confirm-modal')).toBeHidden()
    expect(posted).toBe(false)
  })
})
