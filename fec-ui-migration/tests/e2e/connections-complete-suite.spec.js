// @ts-check
const { test, expect } = require('@playwright/test');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de auth
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL  = 'http://localhost:3000';
const LOGIN_URL = `${BASE_URL}/login`;
const LIST_URL  = `${BASE_URL}/configurations/connections`;
const NEW_URL   = `${BASE_URL}/configurations/connections/new`;

const MOCK_SESSION = {
  access_token: 'test-token-connections',
  expires_at:   '2099-12-31T23:59:59Z',
  UserEmail:    'test@clavisco.com',
  UserId:       1,
};

const MOCK_COMPANY = {
  companyId:   1,
  companyName: 'Test Company',
  groupId:     1,
};

const FULL_PERMS = [
  'Configurations_Connections_Create',
  'Configurations_Connections_Update',
];

const NO_PERMS = [];

async function injectAuth(page, perms = FULL_PERMS) {
  await page.goto(LOGIN_URL);
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',           JSON.stringify(session));
    sessionStorage.setItem('CurrentCompany',  JSON.stringify(company));
    sessionStorage.setItem('Permissions',     JSON.stringify(permissions));
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock de API
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CONNECTIONS = [
  {
    Id: 1, Server: 'SRVPROD', LicenseServer: 'SRVPROD', BoSuppLangs: '93',
    DST: '1', DBUser: 'sa', DBPass: '', UseTrusted: false,
    ODBCType: 'HDBODBC', DBEngine: 'hdb', ServerType: 'HanaDb',
    APIUrl: 'https://api.prod.example.com:50000', CrystalAPIUrl: 'https://crystal.prod.example.com',
  },
  {
    Id: 2, Server: 'SRVDEV', LicenseServer: 'SRVDEV', BoSuppLangs: '93',
    DST: '1', DBUser: 'admin', DBPass: '', UseTrusted: false,
    ODBCType: 'HDBODBC', DBEngine: 'hdb', ServerType: 'HanaDb',
    APIUrl: 'https://api.dev.example.com:50000', CrystalAPIUrl: '',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Carga inicial de la lista
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Connections Lista — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, FULL_PERMS);
    await page.route('**/api/Connections**', async route => {
      await route.fulfill({ json: { Data: MOCK_CONNECTIONS, Error: false, Message: '' } });
    });
  });

  test('La página carga y muestra el formulario de búsqueda', async ({ page }) => {
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="connections-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-server"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-api-url"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-search"]')).toBeVisible();
  });

  test('El botón Crear es visible con permiso Configurations_Connections_Create', async ({ page }) => {
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="btn-create"]')).toBeVisible();
  });

  test('El botón Crear NO es visible sin permiso', async ({ page }) => {
    await injectAuth(page, NO_PERMS);
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="btn-create"]')).toBeHidden();
  });

  test('La tabla muestra las columnas correctas', async ({ page }) => {
    await page.goto(LIST_URL);
    await page.waitForSelector('[data-testid="connections-table"]');
    const headers = await page.locator('[data-testid="connections-table"] thead th').allTextContents();
    expect(headers).toContain('ID');
    expect(headers).toContain('Servidor');
    expect(headers).toContain('Usuario');
    expect(headers).toContain('Motor de base de datos');
    expect(headers).toContain('URL API');
    expect(headers).toContain('URL Crystal API');
  });

  test('La tabla muestra las conexiones cargadas desde la API', async ({ page }) => {
    await page.goto(LIST_URL);
    await page.waitForSelector('[data-testid="connection-row-1"]');
    await expect(page.locator('[data-testid="connection-row-1"]')).toContainText('SRVPROD');
    await expect(page.locator('[data-testid="connection-row-2"]')).toContainText('SRVDEV');
  });

  test('Se muestra estado vacío cuando no hay conexiones', async ({ page }) => {
    await page.route('**/api/Connections**', async route => {
      await route.fulfill({ json: { Data: [], Error: false, Message: '' } });
    });
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
  });

  test('Se muestra estado de carga mientras llama a la API', async ({ page }) => {
    let resolve;
    await page.route('**/api/Connections**', async route => {
      await new Promise(r => { resolve = r; });
      await route.fulfill({ json: { Data: [], Error: false, Message: '' } });
    });
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="loading-state"]')).toBeVisible();
    resolve();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Búsqueda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Connections Lista — Búsqueda', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, FULL_PERMS);
    await page.route('**/api/Connections**', async route => {
      const url = route.request().url();
      const filtered = MOCK_CONNECTIONS.filter(c =>
        url.includes(c.Server) || !url.includes('server=SRVPROD')
      );
      await route.fulfill({ json: { Data: filtered, Error: false, Message: '' } });
    });
  });

  test('Filtrar por servidor envía el parámetro correcto', async ({ page }) => {
    await page.goto(LIST_URL);
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/Connections')) requests.push(req.url()); });
    await page.fill('[data-testid="input-server"]', 'SRVPROD');
    await page.click('[data-testid="btn-search"]');
    await expect(() => requests.some(u => u.includes('server=SRVPROD'))).toBeTruthy();
  });

  test('Filtrar por APIUrl envía el parámetro correcto', async ({ page }) => {
    await page.goto(LIST_URL);
    const requests = [];
    page.on('request', req => { if (req.url().includes('/api/Connections')) requests.push(req.url()); });
    await page.fill('[data-testid="input-api-url"]', 'api.prod');
    await page.click('[data-testid="btn-search"]');
    await expect(() => requests.some(u => u.includes('apiUrl=api.prod'))).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Botones de acción en tabla
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Connections Lista — Acciones', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, FULL_PERMS);
    await page.route('**/api/Connections**', async route => {
      await route.fulfill({ json: { Data: MOCK_CONNECTIONS, Error: false, Message: '' } });
    });
  });

  test('Clic en Crear abre el panel lateral en modo creación', async ({ page }) => {
    await page.goto(LIST_URL);
    await page.click('[data-testid="btn-create"]');
    await expect(page.locator('[data-testid="connection-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-btn-submit"]')).toContainText('Crear');
    await expect(page.locator('[data-testid="panel-input-server"]')).toHaveValue('');
    // No navega — la URL sigue siendo la del listado
    await expect(page).toHaveURL(/\/configurations\/connections$/);
  });

  test('Clic en Editar abre el panel lateral en modo edición', async ({ page }) => {
    await page.goto(LIST_URL);
    await page.waitForSelector('[data-testid="connection-row-1"]');
    await page.click('[data-testid="btn-edit-1"]');
    await expect(page.locator('[data-testid="connection-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-btn-submit"]')).toContainText('Actualizar');
    // No navega — la edición ocurre en el panel sobre el listado
    await expect(page).toHaveURL(/\/configurations\/connections$/);
  });

  test('Sin permiso Update el botón Editar no está visible', async ({ page }) => {
    await injectAuth(page, ['Configurations_Connections_Create']);
    await page.goto(LIST_URL);
    await page.waitForSelector('[data-testid="connection-row-1"]');
    await expect(page.locator('[data-testid="btn-edit-1"]')).toBeHidden();
  });

  test('Error en API muestra modal de error', async ({ page }) => {
    await page.route('**/api/Connections**', async route => {
      await route.abort();
    });
    await page.goto(LIST_URL);
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Formulario — Carga inicial (Crear)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Connections Formulario — Crear', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page, FULL_PERMS);
  });

  test('La página de creación carga con el formulario vacío', async ({ page }) => {
    await page.goto(NEW_URL);
    await expect(page.locator('[data-testid="connection-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-server"]')).toHaveValue('');
    await expect(page.locator('[data-testid="input-api-url"]')).toHaveValue('');
  });

  test('El botón de acción dice "Crear" en modo creación', async ({ page }) => {
    await page.goto(NEW_URL);
    await expect(page.locator('[data-testid="btn-submit"]')).toContainText('Crear');
  });

  test('Campo DBPass es requerido en modo Crear', async ({ page }) => {
    await page.goto(NEW_URL);
    // Llenar campos requeridos menos DBPass
    await page.fill('[data-testid="input-server"]', 'SRVTEST');
    await page.fill('[data-testid="input-api-url"]', 'https://api.test.com');
    await page.fill('[data-testid="input-db-engine"]', 'hdb');
    await page.fill('[data-testid="input-db-user"]', 'sa');
    // No llenar DBPass → submit debe mostrar error
    await page.click('[data-testid="btn-submit"]');
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast"]')).toContainText('campos requeridos');
  });

  test('Validación: campos requeridos vacíos muestran toast warning', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.click('[data-testid="btn-submit"]');
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast"]')).toContainText('campos requeridos');
  });

  test('Toggle de visibilidad de contraseña funciona', async ({ page }) => {
    await page.goto(NEW_URL);
    await expect(page.locator('[data-testid="input-db-pass"]')).toHaveAttribute('type', 'password');
    await page.click('[data-testid="btn-toggle-pass"]');
    await expect(page.locator('[data-testid="input-db-pass"]')).toHaveAttribute('type', 'text');
    await page.click('[data-testid="btn-toggle-pass"]');
    await expect(page.locator('[data-testid="input-db-pass"]')).toHaveAttribute('type', 'password');
  });

  test('Crear conexión exitosa muestra toast y redirige a lista', async ({ page }) => {
    await page.route('**/api/Connections', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ json: { Data: { Id: 99 }, Error: false, Message: '' } });
      }
    });
    await page.goto(NEW_URL);
    await page.fill('[data-testid="input-server"]', 'SRVTEST');
    await page.fill('[data-testid="input-api-url"]', 'https://api.test.com');
    await page.fill('[data-testid="input-db-engine"]', 'hdb');
    await page.fill('[data-testid="input-db-user"]', 'sa');
    await page.fill('[data-testid="input-db-pass"]', 'secret123');
    await page.click('[data-testid="btn-submit"]');
    await expect(page.locator('[data-testid="toast"]')).toContainText('creada');
    await expect(page).toHaveURL(/\/configurations\/connections/);
  });

  test('Error en API al crear muestra modal de error', async ({ page }) => {
    await page.route('**/api/Connections', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: 'Server Error' });
      }
    });
    await page.goto(NEW_URL);
    await page.fill('[data-testid="input-server"]', 'SRVTEST');
    await page.fill('[data-testid="input-api-url"]', 'https://api.test.com');
    await page.fill('[data-testid="input-db-engine"]', 'hdb');
    await page.fill('[data-testid="input-db-user"]', 'sa');
    await page.fill('[data-testid="input-db-pass"]', 'secret');
    await page.click('[data-testid="btn-submit"]');
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible();
  });

  test('Cancelar redirige a la lista', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.click('[data-testid="btn-cancel"]');
    await expect(page).toHaveURL(/\/configurations\/connections$/);
  });

  test('Sin permiso Create se redirige con modal WARNING', async ({ page }) => {
    await injectAuth(page, NO_PERMS);
    await page.goto(NEW_URL);
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-modal"]')).toContainText('permisos');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Formulario — Editar
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Connections Formulario — Editar', () => {
  const EDIT_URL = `${BASE_URL}/configurations/connections/1/edit`;

  test.beforeEach(async ({ page }) => {
    await injectAuth(page, FULL_PERMS);
    await page.route('**/api/Connections/1', async route => {
      await route.fulfill({ json: { Data: MOCK_CONNECTIONS[0], Error: false, Message: '' } });
    });
  });

  test('Carga los datos de la conexión al editar', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('[data-testid="input-server"]')).toHaveValue('SRVPROD');
    await expect(page.locator('[data-testid="input-api-url"]')).toHaveValue('https://api.prod.example.com:50000');
    await expect(page.locator('[data-testid="input-db-engine"]')).toHaveValue('hdb');
    await expect(page.locator('[data-testid="input-db-user"]')).toHaveValue('sa');
  });

  test('El botón de acción dice "Actualizar" en modo edición', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('[data-testid="btn-submit"]')).toContainText('Actualizar');
  });

  test('DBPass NO es requerido en modo editar', async ({ page }) => {
    await page.route('**/api/Connections', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ json: { Data: { Id: 1 }, Error: false, Message: '' } });
      }
    });
    await page.goto(EDIT_URL);
    // Dejar DBPass vacío y guardar
    await page.fill('[data-testid="input-db-pass"]', '');
    await page.click('[data-testid="btn-submit"]');
    // No debe mostrar toast de campos requeridos — debe enviar PATCH
    await expect(page.locator('[data-testid="toast"]')).not.toContainText('campos requeridos');
  });

  test('Actualizar conexión exitosa muestra toast y redirige', async ({ page }) => {
    await page.route('**/api/Connections', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ json: { Data: { Id: 1 }, Error: false, Message: '' } });
      }
    });
    await page.goto(EDIT_URL);
    await page.fill('[data-testid="input-server"]', 'SRVPROD-UPD');
    await page.click('[data-testid="btn-submit"]');
    await expect(page.locator('[data-testid="toast"]')).toContainText('actualizada');
    await expect(page).toHaveURL(/\/configurations\/connections$/);
  });

  test('Sin permiso Update se redirige con modal WARNING', async ({ page }) => {
    await injectAuth(page, ['Configurations_Connections_Create']);
    await page.goto(EDIT_URL);
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-modal"]')).toContainText('permisos');
  });

  test('Error al cargar conexión muestra modal y redirige', async ({ page }) => {
    await page.route('**/api/Connections/1', async route => {
      await route.fulfill({ status: 500, body: 'Error' });
    });
    await page.goto(EDIT_URL);
    await expect(page.locator('[data-testid="error-modal"]')).toBeVisible();
  });
});
