// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const PAGE_URL = `${BASE_URL}/documents/receptions/logs`;

const MOCK_SESSION = {
  access_token: 'mock-token-receptions-logs',
  token_type: 'Bearer',
  expires_at: Date.now() + 86400000,
  UserEmail: 'test@clavisco.com',
  UserId: 'test-user-id',
};
const MOCK_COMPANY = {
  companyId: 1,
  companyName: 'Empresa de Prueba',
  groupId: 1,
};
const MOCK_PERMISSIONS = ['S_ReceptionLogs'];

async function injectAuth(page, perms = MOCK_PERMISSIONS) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session', JSON.stringify(session));
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company));
    sessionStorage.setItem('Permissions', JSON.stringify(permissions));
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms });
}

const MOCK_LOGS = [
  {
    Id: 1,
    TrxDate: '2025-06-10T08:30:00',
    FileName: 'invoice_001.xml',
    EmailFrom: 'proveedor@ejemplo.com',
    Status: 'Procesado',
    Exception: '',
    MailParserInboxEmail: 'recepcion@empresa.com',
  },
  {
    Id: 2,
    TrxDate: '2025-06-10T09:15:00',
    FileName: 'invoice_002.xml',
    EmailFrom: 'otro@proveedor.com',
    Status: 'Error',
    Exception: 'XML inválido',
    MailParserInboxEmail: 'recepcion@empresa.com',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Carga inicial', () => {
  test('página carga con layout protected (menú y toolbar)', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-controller="menu"]')).toBeVisible();
  });

  test('muestra el formulario de fechas con StartDate y EndDate', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('input[name="start_date"], [data-reception-logs-target="inputStartDate"]')).toBeVisible();
    await expect(page.locator('input[name="end_date"], [data-reception-logs-target="inputEndDate"]')).toBeVisible();
  });

  test('fecha inicial es la fecha actual en ambos campos', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    const today = new Date().toISOString().split('T')[0];
    const startVal = await page.locator('[data-reception-logs-target="inputStartDate"]').inputValue();
    const endVal = await page.locator('[data-reception-logs-target="inputEndDate"]').inputValue();
    expect(startVal).toBe(today);
    expect(endVal).toBe(today);
  });

  test('botón Consultar visible', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-action*="search"], button:has-text("Consultar")')).toBeVisible();
  });

  test('tabla vacía en carga inicial (antes de consultar)', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    // La tabla debe existir aunque esté vacía
    await expect(page.locator('[data-reception-logs-target="table"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Botones "Hoy"', () => {
  test('botón Hoy de StartDate restablece a fecha actual', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    // Cambiar el campo a una fecha distinta
    await page.fill('[data-reception-logs-target="inputStartDate"]', '2020-01-01');
    await page.locator('[data-action*="todayStart"], button:near([data-reception-logs-target="inputStartDate"]):has-text("Hoy")').click();
    const today = new Date().toISOString().split('T')[0];
    const val = await page.locator('[data-reception-logs-target="inputStartDate"]').inputValue();
    expect(val).toBe(today);
  });

  test('botón Hoy de EndDate restablece a fecha actual', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await page.fill('[data-reception-logs-target="inputEndDate"]', '2020-01-01');
    await page.locator('[data-action*="todayEnd"], button:near([data-reception-logs-target="inputEndDate"]):has-text("Hoy")').click();
    const today = new Date().toISOString().split('T')[0];
    const val = await page.locator('[data-reception-logs-target="inputEndDate"]').inputValue();
    expect(val).toBe(today);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Validación de fechas', () => {
  test('si StartDate > EndDate muestra modal de error, no llama API', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: [], Message: 'Sin datos' }),
    }));
    await page.goto(PAGE_URL);
    const apiCalled = { called: false };
    page.on('request', req => { if (req.url().includes('GetMailParserLogs')) apiCalled.called = true; });

    await page.fill('[data-reception-logs-target="inputStartDate"]', '2025-06-10');
    await page.fill('[data-reception-logs-target="inputEndDate"]', '2025-06-05');
    await page.locator('button:has-text("Consultar")').click();

    expect(apiCalled.called).toBe(false);
    // Modal de advertencia visible
    await expect(page.locator('[role="dialog"], .cl-modal, .modal')).toBeVisible();
  });

  test('si EndDate > hoy muestra modal de error', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().split('T')[0];

    const apiCalled = { called: false };
    page.on('request', req => { if (req.url().includes('GetMailParserLogs')) apiCalled.called = true; });

    await page.fill('[data-reception-logs-target="inputEndDate"]', futureStr);
    await page.locator('button:has-text("Consultar")').click();

    expect(apiCalled.called).toBe(false);
    await expect(page.locator('[role="dialog"], .cl-modal, .modal')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Búsqueda exitosa', () => {
  test('llama API con companyId, FFini, FFin correctos', async ({ page }) => {
    await injectAuth(page);
    let capturedUrl = '';
    await page.route(`**/api/Log/GetMailParserLogs**`, route => {
      capturedUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
      });
    });
    await page.goto(PAGE_URL);
    await page.fill('[data-reception-logs-target="inputStartDate"]', '2025-06-10');
    await page.fill('[data-reception-logs-target="inputEndDate"]', '2025-06-10');
    await page.locator('button:has-text("Consultar")').click();

    await page.waitForTimeout(500);
    expect(capturedUrl).toContain('companyId=1');
    expect(capturedUrl).toContain('FFini=2025-06-10');
    expect(capturedUrl).toContain('FFin=2025-06-10');
  });

  test('muestra registros en la tabla tras búsqueda exitosa', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.tabulator-row').first()).toBeVisible();
    await expect(page.locator('text=invoice_001.xml')).toBeVisible();
  });

  test('muestra toast success con datos', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 3000 });
  });

  test('muestra toast info cuando no hay datos', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: [], Message: 'No se encontraron logs' }),
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Columnas de tabla', () => {
  async function loadTable(page) {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await page.waitForTimeout(500);
  }

  test('columna "Fecha Log" visible (TrxDateC)', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Fecha Log")')).toBeVisible();
  });

  test('columna "Archivo" visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Archivo")')).toBeVisible();
  });

  test('columna "Remitente" visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Remitente")')).toBeVisible();
  });

  test('columna "Estado" visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Estado")')).toBeVisible();
  });

  test('columna "Error" visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Error")')).toBeVisible();
  });

  test('columna "Bandeja de Entrada" visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Bandeja de Entrada")')).toBeVisible();
  });

  test('columna Id NO visible', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-col:has-text("Id")')).not.toBeVisible();
  });

  test('fecha formateada en filas (yyyy-MM-dd HH:mm:ss)', async ({ page }) => {
    await loadTable(page);
    await expect(page.locator('.tabulator-row').first()).toContainText('2025-06-10');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Descargar Email', () => {
  test('botón mail visible en filas de tabla', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.tabulator-row .material-icons:has-text("mail")').first()).toBeVisible();
  });

  test('clic en botón mail llama a email-processor/{id}/email', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Data: MOCK_LOGS, Message: 'OK' }),
    }));
    let downloadCalled = false;
    await page.route(`**/api/Log/email-processor/**`, route => {
      downloadCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'message/rfc822',
        headers: { 'Content-Disposition': 'attachment; filename="test.eml"' },
        body: 'From: test@test.com\r\nSubject: Test\r\n',
      });
    });
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await page.waitForTimeout(500);
    await page.locator('[data-tooltip="Descargar Email"]').first().click();
    await page.waitForTimeout(500);
    expect(downloadCalled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Logs de Recepción — Manejo de errores', () => {
  test('error de API muestra toast error', async ({ page }) => {
    await injectAuth(page);
    await page.route(`**/api/Log/GetMailParserLogs**`, route => route.fulfill({
      status: 500,
      body: 'Internal Server Error',
    }));
    await page.goto(PAGE_URL);
    await page.locator('button:has-text("Consultar")').click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 3000 });
  });
});
