// @ts-check
const { test, expect } = require('@playwright/test')
const path = require('path')

const BASE_URL = 'http://localhost:3000'
const PAGE_URL = `${BASE_URL}/configurations/general`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loginAndNavigate(page) {
  // Asume sesión activa vía localStorage (token ya establecido en storage)
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid="general-configs-page"]', { timeout: 10000 })
}

// ---------------------------------------------------------------------------
// Suite 1: Carga inicial
// ---------------------------------------------------------------------------
describe('configurations/general — Carga inicial', () => {
  test('La página carga y muestra el formulario', async ({ page }) => {
    await loginAndNavigate(page)

    await expect(page.locator('[data-testid="general-configs-page"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-print-format"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-cedula"]')).toBeVisible()
  })

  test('Muestra un toast de éxito al cargar las configuraciones generales', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: 'C:\\formats\\reporte.rpt' }], Message: 'OK' })
      })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: [{ Code: 'CedulaProveedorSistemas', Json: '3-101-123456', IsActive: true }], Message: 'OK' })
      })
    )

    await loginAndNavigate(page)

    await expect(page.locator('[data-testid="toast-container"]')).toContainText('éxito', { timeout: 5000 })
  })

  test('El campo DefaultPrintFormatPath muestra solo el nombre del archivo', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: 'C:\\server\\formats\\reporte_ventas.rpt' }], Message: 'OK' })
      })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )

    await loginAndNavigate(page)

    const input = page.locator('[data-testid="input-print-format"]')
    await expect(input).toHaveValue('reporte_ventas.rpt')
  })

  test('El campo CedulaProveedorSistemas se carga desde settings', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: [{ Code: 'CedulaProveedorSistemas', Json: '3-101-999999', IsActive: true }], Message: 'OK' })
      })
    )

    await loginAndNavigate(page)

    await expect(page.locator('[data-testid="input-cedula"]')).toHaveValue('3-101-999999')
  })

  test('El campo DefaultPrintFormatPath es readonly', async ({ page }) => {
    await loginAndNavigate(page)
    const input = page.locator('[data-testid="input-print-format"]')
    await expect(input).toHaveAttribute('readonly')
  })
})

// ---------------------------------------------------------------------------
// Suite 2: Control de permisos
// ---------------------------------------------------------------------------
describe('configurations/general — Permisos', () => {
  test('Botón upload NO aparece si no tiene permiso Configurations_General_UploadDefaultPrintFormat', async ({ page }) => {
    // Simular permisos sin upload
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_DownloadDefaultPrintFormat']
    })
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-upload"]')).toBeHidden()
  })

  test('Botón upload SÍ aparece con permiso Configurations_General_UploadDefaultPrintFormat', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-upload"]')).toBeVisible()
  })

  test('Botón download NO aparece si no tiene permiso Configurations_General_DownloadDefaultPrintFormat', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = []
    })
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-download"]')).toBeHidden()
  })

  test('Botón download SÍ aparece con permiso Configurations_General_DownloadDefaultPrintFormat', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_DownloadDefaultPrintFormat']
    })
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-download"]')).toBeVisible()
  })

  test('Botón Actualizar (formato) NO aparece si no tiene permiso upload', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = []
    })
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-update-format"]')).toBeHidden()
  })
})

// ---------------------------------------------------------------------------
// Suite 3: Upload y validación de archivo
// ---------------------------------------------------------------------------
describe('configurations/general — Upload archivo', () => {
  test('Solo acepta archivos .rpt', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await loginAndNavigate(page)

    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'archivo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake content')
    })

    await expect(page.locator('[data-testid="toast-container"]')).toContainText('formato de impresión válido', { timeout: 3000 })
    await expect(page.locator('[data-testid="input-print-format"]')).toHaveValue('')
  })

  test('Acepta archivos .rpt y muestra el nombre en el campo', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await loginAndNavigate(page)

    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'formato_ventas.rpt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fake rpt content')
    })

    await expect(page.locator('[data-testid="input-print-format"]')).toHaveValue('formato_ventas.rpt')
  })

  test('Botón Actualizar (formato) está deshabilitado si no hay archivo seleccionado', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await loginAndNavigate(page)

    await expect(page.locator('[data-testid="btn-update-format"]')).toBeDisabled()
  })

  test('Botón Actualizar (formato) se habilita al seleccionar archivo .rpt', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await loginAndNavigate(page)

    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'reporte.rpt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('rpt')
    })

    await expect(page.locator('[data-testid="btn-update-format"]')).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Suite 4: Actualizar formato de impresión
// ---------------------------------------------------------------------------
describe('configurations/general — Actualizar formato', () => {
  test('Envía PATCH multipart a api/GeneralConfigs con el archivo', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 5, DefaultPrintFormatPath: 'old.rpt' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )

    let patchBody = null
    await page.route('**/api/GeneralConfigs*', async route => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postData()
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: {}, Message: 'OK' }) })
      } else {
        await route.continue()
      }
    })

    await loginAndNavigate(page)

    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'nuevo_formato.rpt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('rpt content')
    })

    await page.locator('[data-testid="btn-update-format"]').click()

    await expect(page.locator('[data-testid="toast-container"]')).toContainText('éxito', { timeout: 5000 })
    expect(patchBody).not.toBeNull()
  })

  test('Muestra overlay durante la actualización del formato', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: 'test.rpt' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )
    await page.route('**/api/GeneralConfigs*', async route => {
      if (route.request().method() === 'PATCH') {
        await new Promise(r => setTimeout(r, 500))
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: {}, Message: 'OK' }) })
      } else {
        await route.continue()
      }
    })

    await loginAndNavigate(page)
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'formato.rpt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x')
    })
    await page.locator('[data-testid="btn-update-format"]').click()

    await expect(page.locator('#stimulus-overlay')).toBeVisible({ timeout: 2000 })
  })

  test('Muestra toast de error si falla la actualización del formato', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: 'old.rpt' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )
    await page.route('**/api/GeneralConfigs*', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, body: 'Server error' })
      } else {
        await route.continue()
      }
    })

    await loginAndNavigate(page)
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'formato.rpt', mimeType: 'application/octet-stream', buffer: Buffer.from('x')
    })
    await page.locator('[data-testid="btn-update-format"]').click()

    await expect(page.locator('[data-testid="toast-container"]')).toContainText('error', { timeout: 5000, ignoreCase: true })
  })
})

// ---------------------------------------------------------------------------
// Suite 5: Actualizar Cédula Proveedor Sistemas
// ---------------------------------------------------------------------------
describe('configurations/general — Actualizar cédula', () => {
  test('Envía PATCH a api/settings con el código correcto', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Code: 'CedulaProveedorSistemas', Json: '3-101-000000', IsActive: true }], Message: 'OK' }) })
      }
      return route.continue()
    })

    let patchPayload = null
    await page.route('**/api/settings', async route => {
      if (route.request().method() === 'PATCH') {
        patchPayload = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: true, Message: 'OK' }) })
      } else {
        await route.continue()
      }
    })

    await loginAndNavigate(page)

    await page.locator('[data-testid="input-cedula"]').fill('3-101-888888')
    await page.locator('[data-testid="btn-update-cedula"]').click()

    await expect(page.locator('[data-testid="toast-container"]')).toContainText('éxito', { timeout: 5000 })
    expect(patchPayload?.Code).toBe('CedulaProveedorSistemas')
    expect(patchPayload?.Json).toBe('3-101-888888')
    expect(patchPayload?.IsActive).toBe(true)
  })

  test('Botón Actualizar cédula siempre está habilitado', async ({ page }) => {
    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="btn-update-cedula"]')).toBeEnabled()
  })

  test('Muestra toast de error si falla actualización de cédula', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, body: 'Error' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
      }
    })

    await loginAndNavigate(page)
    await page.locator('[data-testid="btn-update-cedula"]').click()
    await expect(page.locator('[data-testid="toast-container"]')).toContainText('error', { timeout: 5000, ignoreCase: true })
  })
})

// ---------------------------------------------------------------------------
// Suite 6: Download formato de impresión
// ---------------------------------------------------------------------------
describe('configurations/general — Download formato', () => {
  test('Dispara descarga al hacer click en botón download', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_DownloadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: 'C:\\formats\\reporte.rpt' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )
    await page.route('**/api/GeneralConfigs/default-print-format', route =>
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from('rpt binary content') })
    )

    await loginAndNavigate(page)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-download"]').click()
    ])

    expect(download.suggestedFilename()).toMatch(/\.rpt$|reporte/)
  })

  test('Muestra toast de error si falla el download', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TEST_PERMISSIONS__ = ['Configurations_General_DownloadDefaultPrintFormat']
    })
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )
    await page.route('**/api/GeneralConfigs/default-print-format', route =>
      route.fulfill({ status: 404, body: JSON.stringify({ Message: 'No encontrado' }) })
    )

    await loginAndNavigate(page)
    await page.locator('[data-testid="btn-download"]').click()
    await expect(page.locator('[data-testid="toast-container"]')).toContainText('error', { timeout: 5000, ignoreCase: true })
  })
})

// ---------------------------------------------------------------------------
// Suite 7: Edge cases
// ---------------------------------------------------------------------------
describe('configurations/general — Edge cases', () => {
  test('Si GetGenConfigs retorna Data vacío muestra toast warning', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: null, Message: 'Sin configuraciones' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )

    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="toast-container"]')).toContainText('Sin configuraciones', { timeout: 5000 })
  })

  test('Si GetSettings retorna Data vacío, campo cédula queda vacío', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )

    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="input-cedula"]')).toHaveValue('')
  })

  test('DefaultPrintFormatPath vacío muestra campo vacío', async ({ page }) => {
    await page.route('**/api/GeneralConfigs/GetGeneralConfigs', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [{ Id: 1, DefaultPrintFormatPath: '' }], Message: 'OK' }) })
    )
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [], Message: 'OK' }) })
    )

    await loginAndNavigate(page)
    await expect(page.locator('[data-testid="input-print-format"]')).toHaveValue('')
  })

  test('Rechazar archivo no .rpt limpia el campo', async ({ page }) => {
    await page.addInitScript(() => { window.__TEST_PERMISSIONS__ = ['Configurations_General_UploadDefaultPrintFormat'] })
    await loginAndNavigate(page)

    await page.locator('[data-testid="file-input"]').setInputFiles({ name: 'doc.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
    await expect(page.locator('[data-testid="input-print-format"]')).toHaveValue('')
    await expect(page.locator('[data-testid="btn-update-format"]')).toBeDisabled()
  })
})
