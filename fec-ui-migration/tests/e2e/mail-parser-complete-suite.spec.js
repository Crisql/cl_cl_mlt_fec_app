// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL    = 'http://localhost:3000';
const PAGE_URL    = `${BASE_URL}/configurations/mail-parser`;
const LOGIN_URL   = `${BASE_URL}/login`;

const MOCK_SESSION = {
  access_token: 'mock-token-mail-parser',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  UserEmail: 'test@clavisco.com',
  UserId: 1,
};
const MOCK_COMPANY = {
  companyId: 1,
  companyName: 'Empresa de Prueba',
  groupId: 1,
};
const MOCK_PERMISSIONS = [
  'Configurations_MailParser_UpdateAllProcessingTenantStatus',
  'Configurations_MailParser_UpdateProcessingTenantStatus',
];

async function injectAuth(page) {
  await page.goto(LOGIN_URL);
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session));
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company));
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions));
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: MOCK_PERMISSIONS });
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga inicial
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mail Parser — Carga inicial', () => {
  test('La página carga con el title correcto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page).toHaveTitle(/Procesador de Correo/i);
  });

  test('El controller Stimulus conecta (data-controller presente)', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-controller="mail-parser"]')).toBeVisible();
  });

  test('Los filtros se renderizan con valores por defecto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-testid="filter-status"]')).toHaveValue('2');
    await expect(page.locator('[data-testid="filter-use-token"]')).toHaveValue('2');
  });

  test('La tabla se renderiza', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-testid="mail-parser-table"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mail Parser — Filtros', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
  });

  test('Puede escribir en el filtro de correo', async ({ page }) => {
    await page.fill('[data-testid="filter-email"]', 'test@empresa.com');
    await expect(page.locator('[data-testid="filter-email"]')).toHaveValue('test@empresa.com');
  });

  test('Puede cambiar el filtro de Estado', async ({ page }) => {
    await page.selectOption('[data-testid="filter-status"]', '1');
    await expect(page.locator('[data-testid="filter-status"]')).toHaveValue('1');
  });

  test('Puede cambiar el filtro de Usa Token', async ({ page }) => {
    await page.selectOption('[data-testid="filter-use-token"]', '0');
    await expect(page.locator('[data-testid="filter-use-token"]')).toHaveValue('0');
  });

  test('El botón Consultar está presente y es clickeable', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-search"]')).toBeVisible();
    await page.click('[data-testid="btn-search"]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Panel lateral — Crear
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mail Parser — Panel Crear', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await page.click('[data-testid="btn-new"]');
  });

  test('El panel se abre al hacer click en Crear Nuevo', async ({ page }) => {
    await expect(page.locator('[data-testid="mail-parser-panel"]')).not.toHaveClass(/translate-x-full/);
  });

  test('El título del panel es "Nueva Configuración"', async ({ page }) => {
    await expect(page.locator('[data-testid="panel-title"]')).toHaveText('Nueva Configuración');
  });

  test('El botón Guardar está deshabilitado al abrir el panel', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-save"]')).toBeDisabled();
  });

  test('El panel se cierra al hacer click en Cancelar', async ({ page }) => {
    await page.click('[data-testid="btn-cancel-panel"]');
    await expect(page.locator('[data-testid="mail-parser-panel"]')).toHaveClass(/translate-x-full/);
  });

  test('El panel se cierra al hacer click en el backdrop', async ({ page }) => {
    await page.click('[data-testid="panel-backdrop"]');
    await expect(page.locator('[data-testid="mail-parser-panel"]')).toHaveClass(/translate-x-full/);
  });

  test('Los campos de token están ocultos por defecto', async ({ page }) => {
    const tokenFields = page.locator('[data-mail-parser-target="tokenFields"]');
    await expect(tokenFields).toHaveClass(/hidden/);
  });

  test('Al activar UseToken se muestran los campos de token', async ({ page }) => {
    await page.check('[data-testid="input-use-token"]');
    const tokenFields = page.locator('[data-mail-parser-target="tokenFields"]');
    await expect(tokenFields).not.toHaveClass(/hidden/);
  });

  test('Al activar UseToken se oculta el campo Password', async ({ page }) => {
    await page.check('[data-testid="input-use-token"]');
    const passwordField = page.locator('[data-mail-parser-target="passwordField"]');
    await expect(passwordField).toHaveClass(/hidden/);
  });

  test('Validación: muestra error si ServerDirection está vacío', async ({ page }) => {
    await page.click('[data-testid="btn-validate"]');
    await expect(page.locator('[data-mail-parser-target="errorServer"]')).not.toHaveClass(/hidden/);
  });

  test('Toggle visibility de contraseña', async ({ page }) => {
    const input = page.locator('[data-testid="input-password"]');
    await expect(input).toHaveAttribute('type', 'password');
    await page.click('[data-mail-parser-target="passwordEyeIcon"]');
    await expect(input).toHaveAttribute('type', 'text');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Panel de Compañías Emisoras
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mail Parser — Panel Compañías Emisoras', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
  });

  test('El panel de tenants está oculto por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="tenants-panel"]')).toHaveClass(/hidden/);
  });

  test('El input de búsqueda de tenants existe', async ({ page }) => {
    await expect(page.locator('[data-testid="tenants-search"]')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal de error
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Mail Parser — Modal de error', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
  });

  test('El modal de error está oculto por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="error-modal"]')).toHaveClass(/hidden/);
  });
});
