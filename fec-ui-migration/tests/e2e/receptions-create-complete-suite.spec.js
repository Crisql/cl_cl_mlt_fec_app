// @ts-check
const { test, expect } = require('@playwright/test')

const BASE_URL      = 'http://localhost:3000'
const TARGET_URL    = `${BASE_URL}/documents/receptions/325/create`
const DOC_ID        = 325

const MOCK_SESSION = {
  access_token: 'mock-token-app',
  token_type: 'Bearer',
  expires_at: Date.now() + 86400000,
  UserEmail: 'test@clavisco.com',
  UserId: 'user-001'
}

const MOCK_FE_SESSION = {
  access_token: 'mock-token-fe',
  token_type: 'Bearer',
  expires_in: 3600
}

const MOCK_COMPANY = {
  companyId: 1,
  companyName: 'Empresa Test',
  groupId: 1,
  codigoActividad: '620100',
  SendReceptAndApInv: false
}

const MOCK_PERMISSIONS = ['S_Reception', 'F_CreateAPInvoice']

async function injectAuth(page, perms = MOCK_PERMISSIONS) {
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(({ session, feSession, company, permissions }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    sessionStorage.setItem('currentFEUser', JSON.stringify(feSession))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions', JSON.stringify(permissions))
  }, {
    session: MOCK_SESSION,
    feSession: MOCK_FE_SESSION,
    company: MOCK_COMPANY,
    permissions: perms
  })
}

async function injectShouldRecept(page, value = 'true') {
  await page.evaluate((v) => sessionStorage.setItem('shouldRecept', v), value)
}

// ─────────────────────────────────────────────────────────
// Mocks de API
// ─────────────────────────────────────────────────────────
async function mockAllApis(page) {
  await page.route('**/api/Account/GetAccounts**', async route => {
    await route.fulfill({ json: { Data: [{ AcctCode: '1110', FormatCode: '1110', AcctName: 'Caja', FormatCode: '1110-Caja' }], Message: '' } })
  })
  await page.route('**/api/Documents/GetDocAPInvoiceInfoXML**', async route => {
    await route.fulfill({ json: {
      Data: {
        DocCur: 'CRC', TaxDate: '2026-01-15T00:00:00', CardName: 'Proveedor S.A.',
        NumAtCard: 'REF-001', Comments: 'Factura enero', LicTradNum: '3101234567',
        TotalFactura: 150000, OthersRecepts: [],
        DocReceptXMLLines: [{
          RowId: 1, Code: 'ART-001', Detail: 'Artículo de prueba', DocCur: 'CRC',
          Quantity: 2, UnitPrice: 75000, Discount: 0, TaxAmount: 13000,
          ImpTarifa: 13, TotalLine: 163000, Available: 2, Selected: false,
          IsSelected: false, IsMatchSelected: false
        }]
      },
      Message: ''
    } })
  })
  await page.route('**/api/Documents/GetDocAPInvoiceCharges**', async route => {
    await route.fulfill({ json: { Data: { DocCur: 'CRC', DocChargesXMLLines: [] }, Message: '' } })
  })
  await page.route('**/api/Tax**', async route => {
    await route.fulfill({ json: { Data: [{ TaxCode: 'IVA13', TaxRate: 13 }], Message: '' } })
  })
  await page.route('**/api/Item/GetItems**', async route => {
    await route.fulfill({ json: { Data: [{ ItemCode: 'ART-001', ItemName: 'Artículo de prueba', InvntItem: 'Y', FullName: 'ART-001 - Artículo de prueba' }], Message: '' } })
  })
  await page.route('**/api/companies/1**', async route => {
    await route.fulfill({ json: { Data: { DefaultTaxForXML: 'IVA13', XmlToleranceAmounts: [{ CurrencyCode: 'CRC', Tolerance: 5 }] }, Message: '' } })
  })
  await page.route('**/api/Companies/GetDimensionsAndCntrCost**', async route => {
    await route.fulfill({ json: { Data: [{ DimCode: 'D1', DimName: 'Dimension 1', CenterCost: [] }], Message: '' } })
  })
  await page.route('**/api/Warehouse**', async route => {
    await route.fulfill({ json: { Data: [{ WhsCode: '01', WhsName: 'Bodega Principal' }], Message: '' } })
  })
  await page.route('**/api/Project**', async route => {
    await route.fulfill({ json: { Data: [{ Code: 'PRJ-01', Name: 'Proyecto Principal' }], Message: '' } })
  })
  await page.route('**/api/Companies/1/currencies**', async route => {
    await route.fulfill({ json: { Data: [{ Code: 'CRC', Name: 'Colón Costarricense', Symbol: '₡' }], Message: '' } })
  })
  await page.route('**/api/BusinessPartners**', async route => {
    await route.fulfill({ json: { Data: [{ CardCode: 'V001', CardName: 'Proveedor S.A.', LicTradNum: '3101234567', FullName: 'V001 - Proveedor S.A.', ExtraDays: 30 }], Message: '' } })
  })
  await page.route('**/api/Udf/GetConfiguredUdfs**', async route => {
    await route.fulfill({ json: { Data: [], Message: '' } })
  })
  await page.route('**/api/Documents/GetDocTypeBase**', async route => {
    await route.fulfill({ json: { Data: [{ DocType: 22, DocTypeShow: 'Orden de Compra' }], Message: '' } })
  })
  await page.route('**/api/Documents/GetDocumentInfoPreview**', async route => {
    await route.fulfill({ json: { Data: {
      NumeroConsecutivo: '001-001-00000001',
      FechaEmision: '2026-01-15',
      Clave: '50601012600031012345670100100001010000000115647498',
      Reception: { Mensaje: 1, CondicionImpuesto: '01', TaxFactor: '', CodigoActividad: '620100', DetalleMensaje: '' }
    }, Message: '' } })
  })
}

// ─────────────────────────────────────────────────────────
// SUITE 1: Carga inicial de la página
// ─────────────────────────────────────────────────────────
test.describe('Carga inicial de la página', () => {
  test('La página carga correctamente con layout protected', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('[data-testid="create-reception-page"]')).toBeVisible()
  })

  test('Muestra el título correcto', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Búsqueda de documentos Aceptados')
  })

  test('Los tabs se muestran después de cargar los datos', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="tab-cabecera"]')).toBeVisible({ timeout: 10000 })
  })

  test('El tab Líneas NO se muestra inicialmente (form inválido)', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="tab-lineas"]')).not.toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 2: Acordeón de Recepción de Documentos
// ─────────────────────────────────────────────────────────
test.describe('Acordeón Recepción de Documentos', () => {
  test('El acordeón NO aparece cuando shouldRecept=false', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'false')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="recept-accordion"]')).not.toBeVisible()
  })

  test('El acordeón SÍ aparece cuando shouldRecept=true', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="recept-accordion"]')).toBeVisible({ timeout: 10000 })
  })

  test('El campo Mensaje carga opciones correctas', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    const select = page.locator('[data-testid="recept-mensaje"]')
    await expect(select.locator('option')).toHaveCount(3)
    await expect(select.locator('option[value="1"]')).toContainText('Aceptado')
    await expect(select.locator('option[value="2"]')).toContainText('Aceptar Parcialmente')
    await expect(select.locator('option[value="3"]')).toContainText('Rechazado')
  })

  test('CondicionImpuesto tiene 5 opciones', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    const select = page.locator('[data-testid="recept-condicion-impuesto"]')
    await expect(select.locator('option')).toHaveCount(5)
  })

  test('TaxFactor está deshabilitado por defecto', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="recept-tax-factor"]')).toBeDisabled()
  })

  test('TaxFactor se habilita cuando CondicionImpuesto=03', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="recept-condicion-impuesto"]').selectOption('03')
    await expect(page.locator('[data-testid="recept-tax-factor"]')).not.toBeDisabled()
  })

  test('TaxFactor se habilita cuando CondicionImpuesto=05', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="recept-condicion-impuesto"]').selectOption('05')
    await expect(page.locator('[data-testid="recept-tax-factor"]')).not.toBeDisabled()
  })

  test('TaxFactor se deshabilita cuando CondicionImpuesto vuelve a 01', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="recept-condicion-impuesto"]').selectOption('03')
    await page.locator('[data-testid="recept-condicion-impuesto"]').selectOption('01')
    await expect(page.locator('[data-testid="recept-tax-factor"]')).toBeDisabled()
  })

  test('Error CodigoActividad requerido se muestra cuando vacío', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="recept-codigo-actividad"]').fill('')
    await page.locator('[data-testid="recept-codigo-actividad"]').blur()
    await expect(page.locator('[data-testid="error-codigo-actividad"]')).toBeVisible()
  })

  test('Pre-rellena campos desde GetDocumentInfoPreview', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="recept-codigo-actividad"]')).toHaveValue('620100', { timeout: 10000 })
  })

  test('Botón Previsualizar abre el panel lateral', async ({ page }) => {
    await injectAuth(page)
    await injectShouldRecept(page, 'true')
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="btn-previsualizar"]').click()
    await expect(page.locator('[data-testid="preview-panel"]')).not.toHaveClass(/translate-x-full/)
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 3: Tab Cabecera
// ─────────────────────────────────────────────────────────
test.describe('Tab Cabecera', () => {
  async function goToCabecera(page) {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="tab-cabecera"]').click()
  }

  test('DocDate se pre-rellena desde xmlDoc.TaxDate', async ({ page }) => {
    await goToCabecera(page)
    const docDate = page.locator('[data-testid="input-doc-date"]')
    await expect(docDate).toHaveValue(/2026-01-15/, { timeout: 10000 })
  })

  test('CardName se pre-rellena desde xmlDoc', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="input-card-name"]')).toHaveValue('Proveedor S.A.', { timeout: 10000 })
  })

  test('NumAtCard se pre-rellena desde xmlDoc', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="input-num-at-card"]')).toHaveValue('REF-001', { timeout: 10000 })
  })

  test('DocCur se pre-rellena y es readonly', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="input-doc-cur"]')).toHaveValue('CRC', { timeout: 10000 })
    await expect(page.locator('[data-testid="input-doc-cur"]')).toBeDisabled()
  })

  test('CardCode muestra error required si está vacío', async ({ page }) => {
    await goToCabecera(page)
    await page.locator('[data-testid="input-card-code"]').focus()
    await page.locator('[data-testid="input-card-code"]').blur()
    await expect(page.locator('[data-testid="error-card-code"]')).toBeVisible()
  })

  test('Botón Hoy en DocDate rellena la fecha actual', async ({ page }) => {
    await goToCabecera(page)
    await page.locator('[data-testid="btn-today-doc-date"]').click()
    const today = new Date().toISOString().split('T')[0]
    await expect(page.locator('[data-testid="input-doc-date"]')).toHaveValue(today)
  })

  test('RefDocEntry está deshabilitado hasta seleccionar RefDocType', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="input-ref-doc-entry"]')).toBeDisabled()
  })

  test('RefDocEntry se habilita al seleccionar RefDocType', async ({ page }) => {
    await goToCabecera(page)
    await page.locator('[data-testid="select-ref-doc-type"]').selectOption('22')
    await expect(page.locator('[data-testid="input-ref-doc-entry"]')).not.toBeDisabled()
  })

  test('Checkbox "Cerrar documento de referencia" deshabilitado sin selectedDocEntry', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="check-close-ref-doc"]')).toBeDisabled()
  })

  test('Comments tiene máximo 254 caracteres', async ({ page }) => {
    await goToCabecera(page)
    const textarea = page.locator('[data-testid="input-comments"]')
    await expect(textarea).toHaveAttribute('maxlength', '254')
  })

  test('Contador de caracteres en Comments se actualiza', async ({ page }) => {
    await goToCabecera(page)
    await page.locator('[data-testid="input-comments"]').fill('Hola')
    await expect(page.locator('[data-testid="comments-char-count"]')).toContainText('4')
  })

  test('Botones Crear SAP deshabilitados cuando form inválido', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="btn-create-draft"]')).toBeDisabled()
    await expect(page.locator('[data-testid="btn-create-sap"]')).toBeDisabled()
  })

  test('Tabla de totales muestra SubTotal, Impuestos, Descuento, Total', async ({ page }) => {
    await goToCabecera(page)
    await expect(page.locator('[data-testid="totals-subtotal"]')).toBeVisible()
    await expect(page.locator('[data-testid="totals-impuestos"]')).toBeVisible()
    await expect(page.locator('[data-testid="totals-descuento"]')).toBeVisible()
    await expect(page.locator('[data-testid="totals-total"]')).toBeVisible()
  })

  test('Autocomplete proveedor filtra por código y nombre', async ({ page }) => {
    await goToCabecera(page)
    await page.locator('[data-testid="input-card-code"]').fill('V001')
    await expect(page.locator('[data-testid="autocomplete-supplier-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="autocomplete-supplier-list"]')).toContainText('V001 - Proveedor S.A.')
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 4: Tab Líneas
// ─────────────────────────────────────────────────────────
test.describe('Tab Líneas', () => {
  async function goToLineas(page) {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    // Llenar campos requeridos de cabecera para hacer el form válido
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.locator('[data-testid="autocomplete-supplier-list"] [data-testid="option-V001"]').click()
    await page.locator('[data-testid="tab-lineas"]').click()
  }

  test('Tab Líneas aparece cuando Cabecera es válido', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    // Inicialmente no visible
    await expect(page.locator('[data-testid="tab-lineas"]')).not.toBeVisible()
    // Llenar CardCode requerido
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    // Tab debería aparecer
    await expect(page.locator('[data-testid="tab-lineas"]')).toBeVisible({ timeout: 5000 })
  })

  test('Tabla XML muestra las líneas del documento', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="tab-lineas"]').click()
    await expect(page.locator('[data-testid="xml-lines-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="xml-lines-table"]')).toContainText('ART-001')
  })

  test('Tabla de líneas SAP inicialmente vacía', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="tab-lineas"]').click()
    await expect(page.locator('[data-testid="sap-lines-table"]')).toContainText('Sin líneas')
  })

  test('Al cambiar a tab Líneas, CardCode se deshabilita', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="tab-lineas"]').click()
    await expect(page.locator('[data-testid="input-card-code"]')).toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 5: Validación de moneda del XML
// ─────────────────────────────────────────────────────────
test.describe('Validación de moneda XML', () => {
  test('Si xmlDoc.DocCur existe en companyCurrencies, carga normalmente', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="currency-mismatch-modal"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="tab-cabecera"]')).toBeVisible({ timeout: 10000 })
  })

  test('Si xmlDoc.DocCur NO existe en companyCurrencies, muestra modal de moneda', async ({ page }) => {
    await injectAuth(page)
    await page.route('**/api/Documents/GetDocAPInvoiceInfoXML**', async route => {
      await route.fulfill({ json: { Data: {
        DocCur: 'USD', TaxDate: '2026-01-15T00:00:00', CardName: 'Proveedor S.A.',
        NumAtCard: 'REF-001', Comments: '', LicTradNum: '3101234567',
        TotalFactura: 100, OthersRecepts: [], DocReceptXMLLines: []
      }, Message: '' } })
    })
    // rest of mocks
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await expect(page.locator('[data-testid="currency-mismatch-modal"]')).toBeVisible({ timeout: 10000 })
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 6: Autocomplete de documento base
// ─────────────────────────────────────────────────────────
test.describe('Autocomplete documento base', () => {
  test('Al ingresar texto busca documentos con debounce', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.route('**/api/Documents/sap**', async route => {
      await route.fulfill({ json: { Data: [{ DocNum: 100, DocEntry: 1, CardCode: 'V001', CardName: 'Proveedor S.A.' }], Message: '' } })
    })
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="select-ref-doc-type"]').selectOption('22')
    await page.locator('[data-testid="input-ref-doc-entry"]').fill('100')
    // esperar debounce 260ms
    await page.waitForTimeout(400)
    await expect(page.locator('[data-testid="ref-doc-autocomplete-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="ref-doc-autocomplete-list"]')).toContainText('#100 - V001, Proveedor S.A.')
  })

  test('Si hay exactamente 1 resultado, lo selecciona automáticamente', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.route('**/api/Documents/sap**', async route => {
      await route.fulfill({ json: { Data: [{ DocNum: 100, DocEntry: 1, CardCode: 'V001', CardName: 'Proveedor S.A.' }], Message: '' } })
    })
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="select-ref-doc-type"]').selectOption('22')
    await page.locator('[data-testid="input-ref-doc-entry"]').fill('100')
    await page.waitForTimeout(400)
    await expect(page.locator('[data-testid="check-close-ref-doc"]')).not.toBeDisabled({ timeout: 5000 })
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 7: Creación de factura SAP
// ─────────────────────────────────────────────────────────
test.describe('Crear factura SAP', () => {
  test('POST correcto muestra modal de éxito y navega', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.route('**/api/documents/ap-invoices', async route => {
      await route.fulfill({ json: { Data: { DocNum: 500 }, Message: '' } })
    })
    await page.goto(TARGET_URL)
    // Llenar form mínimo
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="btn-create-sap"]').click()
    await expect(page.locator('[data-testid="success-modal"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="success-modal"]')).toContainText('500')
  })

  test('POST con error muestra modal de error', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.route('**/api/documents/ap-invoices', async route => {
      await route.fulfill({ json: { Data: null, Message: 'Error en SAP' } })
    })
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="btn-create-sap"]').click()
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible({ timeout: 5000 })
  })

  test('Crear borrador usa endpoint ap-invoices con DocObjectCode oPurchaseInvoices', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    let capturedBody = null
    await page.route('**/api/documents/ap-invoices', async route => {
      capturedBody = JSON.parse(route.request().postData())
      await route.fulfill({ json: { Data: { DocNum: 501 }, Message: '' } })
    })
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="btn-create-draft"]').click()
    await expect(page.locator('[data-testid="success-modal"]')).toBeVisible({ timeout: 5000 })
    expect(capturedBody?.APInvoice?.DocObjectCode).toBe('oPurchaseInvoices')
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 8: Validación de tolerancia de montos
// ─────────────────────────────────────────────────────────
test.describe('Validación tolerancia de montos', () => {
  test('Si total excede tolerancia, muestra toast de advertencia', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    // TotalFactura del XML = 150000, tolerancia CRC = 5
    // Si total de líneas = 0 (sin líneas agregadas), debería rechazar
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="btn-create-sap"]').click()
    // Debe mostrar toast o mensaje de error de tolerancia
    await expect(page.locator('[data-testid="toast-container"], [data-testid="error-modal"]')).toBeVisible({ timeout: 5000 })
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 9: Navegación de retorno
// ─────────────────────────────────────────────────────────
test.describe('Navegación de retorno', () => {
  test('Navega a /documents/receptions al cerrar modal de éxito', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.route('**/api/documents/ap-invoices', async route => {
      await route.fulfill({ json: { Data: { DocNum: 500 }, Message: '' } })
    })
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="input-card-code"]').fill('V001 - Proveedor S.A.')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="btn-create-sap"]').click()
    await page.locator('[data-testid="success-modal-ok"]').click()
    await expect(page).toHaveURL(`${BASE_URL}/documents/receptions`)
  })
})

// ─────────────────────────────────────────────────────────
// SUITE 10: Botón Refrescar Datos
// ─────────────────────────────────────────────────────────
test.describe('Refrescar Datos', () => {
  test('Botón Refrescar abre modal de confirmación', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="btn-refresh"]').click()
    await expect(page.locator('[data-testid="confirm-refresh-modal"]')).toBeVisible()
  })

  test('Confirmar recarga la página', async ({ page }) => {
    await injectAuth(page)
    await mockAllApis(page)
    await page.goto(TARGET_URL)
    await page.locator('[data-testid="btn-refresh"]').click()
    await page.locator('[data-testid="confirm-refresh-yes"]').click()
    // La página debe recargar
    await expect(page).toHaveURL(TARGET_URL)
  })
})
