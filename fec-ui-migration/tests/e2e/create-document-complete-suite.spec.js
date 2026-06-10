// @ts-check
// Suite E2E — Creación de Documentos Electrónicos (/documents/:type/create)
// Migración Angular /createDocument/:docType → Rails. Cubre FE(01) ND(02) NC(03) FEC(08) REP(10).
const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:3000'
const urlFor = (type) => `${BASE_URL}/documents/${type}/create`

const MOCK_SESSION = {
  access_token: 'mock-token-app',
  token_type: 'Bearer',
  expires_at: Date.now() + 86400000,
  UserEmail: 'test@clavisco.com',
  UserId: 'user-001',
}
const MOCK_FE_SESSION = { access_token: 'mock-token-fe', token_type: 'Bearer', expires_in: 3600 }
const MOCK_COMPANY = { companyId: 1, companyName: 'Empresa Test', groupId: 1, codigoActividad: '620100' }
const MOCK_PERMISSIONS = [
  'M_Documents', 'S_CreateDocsFE', 'S_CreateDocsND', 'S_CreateDocsNC', 'S_CreateDocsFEC', 'S_CreateDocsREP',
]

async function injectAuth(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(({ session, feSession, company, permissions }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    sessionStorage.setItem('currentFEUser', JSON.stringify(feSession))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions', JSON.stringify(permissions))
  }, { session: MOCK_SESSION, feSession: MOCK_FE_SESSION, company: MOCK_COMPANY, permissions: MOCK_PERMISSIONS })
}

// ─────────── Mocks de API ───────────
async function mockApis(page, opts = {}) {
  const createResult = opts.createResult ?? {
    result: true, HaciendaInfo: { Estado: 'Aceptado', Clave: '506-CLAVE-001' }, Message: 'OK',
  }

  await page.route('**/api/Documents/GetPharmaceuticalForms**', r =>
    r.fulfill({ json: { Data: [{ Id: '1', Description: 'Tabletas' }] } }))

  await page.route('**/api/Companies/*/activity-codes**', r =>
    r.fulfill({ json: { Data: [{ Code: '620100', Description: 'Programación informática' }] } }))

  await page.route('**/api/Customer**', r =>
    r.fulfill({ json: { Data: [
      { RcprNombre: 'Cliente Uno S.A.', RcprIdeNumero: '3101123456', RcprIdeTipo: '02', CodigoActividad: '620100', RcprCorreoElectronico: 'cliente@test.com' },
      { RcprNombre: 'Juan Pérez', RcprIdeNumero: '102340567', RcprIdeTipo: '01' },
    ] } }))

  await page.route('**/api/Numbering/GetTerminalSucursal**', r =>
    r.fulfill({ json: { Data: [{ Terminal: 1, SucursalNum: 1 }, { Terminal: 2, SucursalNum: 1 }] } }))

  await page.route('**/api/Cabys**', r =>
    r.fulfill({ json: { cabys: [{ codigo: '8311100000000', descripcion: 'Servicio de prueba' }] } }))

  await page.route('**/api/Documents/CreateDocumentManual**', r =>
    r.fulfill({ json: createResult }))
}

async function gotoDoc(page, type, opts) {
  await injectAuth(page)
  await mockApis(page, opts)
  await page.goto(urlFor(type))
  await expect(page.getByTestId('create-document-page')).toBeVisible()
  // esperar carga de catálogos
  await expect(page.getByTestId('field-condicion-venta').locator('option').first()).toBeAttached()
}

// Agrega un ítem mínimo válido vía el panel
async function addBasicItem(page, { price = '1000', qty = '2' } = {}) {
  await page.getByTestId('btn-add-item').click()
  await expect(page.getByTestId('item-cabys')).toBeVisible()
  await page.getByTestId('item-cabys').fill('8311100000000')
  await page.getByTestId('item-code').fill('ITM-1')
  await page.getByTestId('item-description').fill('Producto de prueba')
  await page.getByTestId('item-quantity').fill(qty)
  await page.getByTestId('item-price').fill(price)
  // unidad de medida: elegir la primera opción real
  await page.getByTestId('item-unit').fill('Sp')
  await page.getByTestId('item-save').click()
}

// ════════════════════════════════════════════════════════════
test.describe('Create Document — Carga inicial por docType', () => {
  const cases = [
    { type: '01', title: 'Factura Electrónica' },
    { type: '02', title: 'Nota de Débito Electrónica' },   // trampa: ND=02 → Débito
    { type: '03', title: 'Nota de Crédito Electrónica' },  // trampa: NC=03 → Crédito
    { type: '08', title: 'Factura Electrónica de Compra' },
    { type: '10', title: 'Recibo Electronico de Pago' },
  ]

  for (const c of cases) {
    test(`docType ${c.type} muestra título "${c.title}"`, async ({ page }) => {
      await gotoDoc(page, c.type)
      await expect(page.getByTestId('page-title')).toHaveText(c.title)
      await expect(page.getByTestId('field-doctype')).toHaveValue(c.type)
    })
  }

  test('FEC (08) muestra "Datos del Emisor" y campo Registro Fiscal 8707', async ({ page }) => {
    await gotoDoc(page, '08')
    await expect(page.getByTestId('section-cliente')).toContainText('Datos del Emisor')
    await expect(page.getByTestId('field-registro-8707')).toBeVisible()
  })

  test('REP (10) oculta ubicación y usa "Información de pago"', async ({ page }) => {
    await gotoDoc(page, '10')
    await expect(page.getByTestId('section-ubicacion')).toBeHidden()
    await expect(page.getByTestId('section-items')).toContainText('Informacion de pago')
  })

  test('FE (01) muestra sección de ubicación', async ({ page }) => {
    await gotoDoc(page, '01')
    await expect(page.getByTestId('section-ubicacion')).toBeVisible()
  })
})

test.describe('Create Document — Datos generales', () => {
  test('Moneda CRC fija tipo de cambio en 1 y lo deshabilita', async ({ page }) => {
    await gotoDoc(page, '01')
    await expect(page.getByTestId('field-exchange-rate')).toHaveValue('1')
    await expect(page.getByTestId('field-exchange-rate')).toBeDisabled()
  })

  test('Moneda USD habilita el tipo de cambio', async ({ page }) => {
    await gotoDoc(page, '01')
    await page.getByTestId('field-currency').selectOption('USD')
    await expect(page.getByTestId('field-exchange-rate')).toBeEnabled()
  })

  test('Fecha inicial es hoy y es de solo lectura', async ({ page }) => {
    await gotoDoc(page, '01')
    const today = new Date().toISOString().split('T')[0]
    await expect(page.getByTestId('field-fecha')).toHaveValue(today)
    await expect(page.getByTestId('field-fecha')).toHaveAttribute('readonly', '')
  })
})

test.describe('Create Document — Búsqueda de cliente', () => {
  test('Abre el panel y selecciona un cliente', async ({ page }) => {
    await gotoDoc(page, '01')
    await page.getByTestId('btn-search-customer').click()
    await expect(page.getByTestId('customer-search-input')).toBeVisible()
    await expect(page.getByTestId('customer-row-0')).toBeVisible()
    await page.getByTestId('customer-row-0').click()
    await expect(page.getByTestId('field-cliente')).toHaveValue('Cliente Uno S.A.')
    await expect(page.getByTestId('field-id-numero')).toHaveValue('3101123456')
  })

  test('Columna Registro 8707 visible solo en FEC', async ({ page }) => {
    await gotoDoc(page, '08')
    await page.getByTestId('btn-search-customer').click()
    await expect(page.getByTestId('customer-search-input')).toBeVisible()
    // la columna 8707 no debe estar oculta en FEC
    await expect(page.locator('[data-documents-create-target="customerCol8707"]')).toBeVisible()
  })
})

test.describe('Create Document — Ítems y totales', () => {
  test('Agrega ítem y actualiza totales', async ({ page }) => {
    await gotoDoc(page, '01')
    await addBasicItem(page, { price: '1000', qty: '2' })
    // 2 * 1000 = 2000 subtotal
    await expect(page.getByTestId('items-body') ).toBeAttached()
    await expect(page.locator('[data-documents-create-target="totalSubtotal"]')).toContainText('2.000')
  })

  test('Elimina ítem y limpia la tabla', async ({ page }) => {
    await gotoDoc(page, '01')
    await addBasicItem(page)
    await page.locator('[data-action*="removeItem"]').first().click()
    await expect(page.locator('[data-documents-create-target="itemsBody"]')).toContainText('Sin ítems agregados')
  })
})

test.describe('Create Document — Referencias', () => {
  test('Agrega y elimina referencias respetando el mínimo', async ({ page }) => {
    await gotoDoc(page, '01')
    await page.getByTestId('btn-add-reference').click()
    const cards = page.locator('[data-ref-id]')
    await expect(cards).toHaveCount(2)
    // El primer botón eliminar de la primera referencia funciona (quedan >= 1)
    await page.locator('[data-action*="removeReference"]').first().click()
    await expect(page.locator('[data-ref-id]')).toHaveCount(1)
  })
})

test.describe('Create Document — Medios de pago', () => {
  test('Agrega medio de pago (máx 4)', async ({ page }) => {
    await gotoDoc(page, '01')
    await page.getByTestId('btn-add-medio-pago').click()
    await page.getByTestId('btn-add-medio-pago').click()
    await page.getByTestId('btn-add-medio-pago').click()
    // 1 inicial + 3 = 4 → botón deshabilitado
    await expect(page.getByTestId('btn-add-medio-pago')).toBeDisabled()
  })
})

test.describe('Create Document — Terminal/Sucursal', () => {
  test('El selector inline se carga y autoselecciona la primera opción', async ({ page }) => {
    await gotoDoc(page, '01')
    const sel = page.getByTestId('term-suc-select')
    await expect(sel).toBeVisible()
    // Se autoselecciona la primera terminal/sucursal (índice 0)
    await expect(sel).toHaveValue('0')
    await expect(sel.locator('option')).toHaveCount(2)
  })
})

test.describe('Create Document — Envío', () => {
  test('Sin ítems muestra advertencia y no envía', async ({ page }) => {
    await gotoDoc(page, '01')
    await page.getByTestId('btn-submit').click()
    // toast de advertencia (no modal de éxito)
    await expect(page.locator('[data-documents-create-target="successModal"]')).toBeHidden()
  })

  test('Flujo completo FE → modal de éxito', async ({ page }) => {
    await gotoDoc(page, '01')
    // cliente
    await page.getByTestId('btn-search-customer').click()
    await page.getByTestId('customer-row-0').click()
    // ítem
    await addBasicItem(page, { price: '1000', qty: '1' })
    // terminal/sucursal
    await page.getByTestId('term-suc-select').selectOption({ index: 0 })
    // enviar
    await page.getByTestId('btn-submit').click()
    await expect(page.locator('[data-documents-create-target="successModal"]')).toBeVisible()
    await expect(page.locator('[data-documents-create-target="successSubtitle"]')).toContainText('Clave')
  })

  test('Respuesta sin HaciendaInfo → modal de advertencia y botón "Reenviar"', async ({ page }) => {
    await gotoDoc(page, '01', { createResult: { result: true, HaciendaInfo: null, DocId: 99, errorInfo: { Message: 'Pendiente en Hacienda' } } })
    await page.getByTestId('btn-search-customer').click()
    await page.getByTestId('customer-row-0').click()
    await addBasicItem(page, { price: '1000', qty: '1' })
    await page.getByTestId('term-suc-select').selectOption({ index: 0 })
    await page.getByTestId('btn-submit').click()
    await expect(page.locator('[data-documents-create-target="warningModal"]')).toBeVisible()
    await expect(page.locator('[data-documents-create-target="btnSubmitLabel"]')).toHaveText('Reenviar')
  })
})
