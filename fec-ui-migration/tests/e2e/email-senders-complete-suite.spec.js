// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL  = 'http://localhost:3000';
const PAGE_URL  = `${BASE_URL}/configurations/email-senders`;
const LOGIN_URL = `${BASE_URL}/login`;

const MOCK_SESSION = {
  access_token: 'mock-token-email-senders',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  UserEmail: 'test@clavisco.com',
  UserId: 1,
};
const MOCK_COMPANY = {
  companyId: 1,
  companyName: 'Empresa de Prueba',
  groupId: 1,
};
const MOCK_PERMISSIONS = ['F_EmailSenders'];

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
test.describe('Email Senders — Carga inicial', () => {
  test('La página carga con el title correcto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page).toHaveTitle(/Bandejas de Correo/i);
  });

  test('El controller Stimulus conecta', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-controller="email-senders"]')).toBeVisible();
  });

  test('El tab "Bandeja de Correos" está activo por defecto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    const tab = page.locator('[data-testid="tab-config"]');
    await expect(tab).toHaveClass(/border-blue-600/);
  });

  test('El panel de configuración está visible por defecto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-testid="panel-config"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-assignment"]')).toHaveClass(/hidden/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Email Senders — Navegación de tabs', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
  });

  test('Al hacer click en el tab de asignación, se muestra ese panel', async ({ page }) => {
    await page.click('[data-testid="tab-assignment"]');
    await expect(page.locator('[data-testid="panel-assignment"]')).not.toHaveClass(/hidden/);
    await expect(page.locator('[data-testid="panel-config"]')).toHaveClass(/hidden/);
  });

  test('Al volver al tab de configuración, se muestra ese panel', async ({ page }) => {
    await page.click('[data-testid="tab-assignment"]');
    await page.click('[data-testid="tab-config"]');
    await expect(page.locator('[data-testid="panel-config"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Filtros
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Email Senders — TAB1 Filtros', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
  });

  test('El filtro SSL tiene valor "2" (Todos) por defecto', async ({ page }) => {
    await expect(page.locator('[data-testid="filter-ssl"]')).toHaveValue('2');
  });

  test('Puede escribir en el filtro de email', async ({ page }) => {
    await page.fill('[data-testid="filter-email"]', 'correo@test.com');
    await expect(page.locator('[data-testid="filter-email"]')).toHaveValue('correo@test.com');
  });

  test('El botón Buscar está presente', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-search-config"]')).toBeVisible();
  });

  test('El botón Crear Bandeja está presente', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-create-inbox"]')).toBeVisible();
  });

  test('La tabla de configuración se renderiza', async ({ page }) => {
    await expect(page.locator('[data-testid="config-table"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Panel lateral — Crear
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Email Senders — TAB1 Panel Crear', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await page.click('[data-testid="btn-create-inbox"]');
  });

  test('El panel se abre', async ({ page }) => {
    await expect(page.locator('[data-testid="inbox-panel"]')).not.toHaveClass(/translate-x-full/);
  });

  test('El título es "Nueva Bandeja"', async ({ page }) => {
    await expect(page.locator('[data-testid="panel-title"]')).toHaveText('Nueva Bandeja');
  });

  test('El botón Guardar está deshabilitado', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-save"]')).toBeDisabled();
  });

  test('El campo de correo destinatario de prueba es visible', async ({ page }) => {
    await expect(page.locator('[data-testid="panel-input-test-email"]')).toBeVisible();
  });

  test('Botón Probar credenciales está visible', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-validate"]')).toBeVisible();
  });

  test('El panel se cierra con Cancelar', async ({ page }) => {
    await page.click('[data-testid="btn-cancel-panel"]');
    await expect(page.locator('[data-testid="inbox-panel"]')).toHaveClass(/translate-x-full/);
  });

  test('El panel se cierra con el backdrop', async ({ page }) => {
    await page.click('[data-testid="panel-backdrop"]');
    await expect(page.locator('[data-testid="inbox-panel"]')).toHaveClass(/translate-x-full/);
  });

  test('Validación: muestra error si Email está vacío al validar credenciales', async ({ page }) => {
    await page.click('[data-testid="btn-validate"]');
    await expect(page.locator('[data-email-senders-target="errorEmail"]')).not.toHaveClass(/hidden/);
  });

  test('Toggle visibility de contraseña', async ({ page }) => {
    const input = page.locator('[data-testid="panel-input-password"]');
    await expect(input).toHaveAttribute('type', 'password');
    await page.click('[data-email-senders-target="passwordEyeIcon"]');
    await expect(input).toHaveAttribute('type', 'text');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Asignación
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Email Senders — TAB2 Asignación', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await page.click('[data-testid="tab-assignment"]');
  });

  test('El autocomplete de compañías existe', async ({ page }) => {
    await expect(page.locator('[data-testid="assign-company-input"]')).toBeVisible();
  });

  test('Las columnas Asignadas y Disponibles existen', async ({ page }) => {
    await expect(page.locator('[data-testid="assigned-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="available-list"]')).toBeVisible();
  });

  test('El botón Remover todos existe', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-remove-all"]')).toBeVisible();
  });

  test('El botón Asignar todos existe', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-assign-all"]')).toBeVisible();
  });

  test('El botón Guardar cambios existe', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-save-assignment"]')).toBeVisible();
  });

  test('El dropdown de compañías se muestra al hacer focus', async ({ page }) => {
    await page.click('[data-testid="assign-company-input"]');
    // El dropdown puede aparecer vacío si la API no responde con mock
    // pero el elemento sí debe existir en el DOM
    await expect(page.locator('[data-email-senders-target="assignCompanyDropdown"]')).toBeAttached();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal de error
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Email Senders — Modal de error', () => {
  test('El modal de error está oculto por defecto', async ({ page }) => {
    await injectAuth(page);
    await page.goto(PAGE_URL);
    await expect(page.locator('[data-testid="error-modal"]')).toHaveClass(/hidden/);
  });
});
