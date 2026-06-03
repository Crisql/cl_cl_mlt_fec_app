// @ts-check
const { test, expect } = require('@playwright/test')

const LOGIN_URL = '/login'
const HOME_URL = '/home'
const VALID_USER = { email: 'test@clavisco.com', password: 'Test1234!' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillAndSubmit(page, email, password) {
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', password)
  await page.click('[data-testid="submit"]')
}

async function clearSession(page) {
  await page.evaluate(() => {
    localStorage.removeItem('Session')
    localStorage.removeItem('UserInfo')
    localStorage.removeItem('Companies')
    localStorage.removeItem('CurrentCompany')
  })
}

async function setValidSession(page) {
  await page.evaluate(() => {
    localStorage.setItem('Session', JSON.stringify({
      access_token: 'fake-token',
      expires_in: 3600,
      token_type: 'Bearer',
      expires_at: Date.now() + 3600000
    }))
  })
}

// ---------------------------------------------------------------------------
// Suite: Carga inicial
// ---------------------------------------------------------------------------

test.describe('Login — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL)
    await clearSession(page)
    await page.goto(LOGIN_URL)
  })

  test('página carga correctamente', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(LOGIN_URL))
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
  })

  test('muestra logo de Clavisco', async ({ page }) => {
    const logo = page.locator('[data-testid="login-logo"]')
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('src', /Logo-Clavisco/)
  })

  test('campo email visible y vacío', async ({ page }) => {
    const email = page.locator('[data-testid="email"]')
    await expect(email).toBeVisible()
    await expect(email).toHaveValue('')
  })

  test('campo password visible y vacío', async ({ page }) => {
    const password = page.locator('[data-testid="password"]')
    await expect(password).toBeVisible()
    await expect(password).toHaveValue('')
  })

  test('botón submit visible', async ({ page }) => {
    await expect(page.locator('[data-testid="submit"]')).toBeVisible()
  })

  test('campo password tiene type=password', async ({ page }) => {
    await expect(page.locator('[data-testid="password"]')).toHaveAttribute('type', 'password')
  })
})

// ---------------------------------------------------------------------------
// Suite: Guard — usuario autenticado
// ---------------------------------------------------------------------------

test.describe('Login — Guard de autenticación', () => {
  test('usuario autenticado es redirigido a /home', async ({ page }) => {
    await page.goto('/')
    await setValidSession(page)
    await page.goto(LOGIN_URL)
    await expect(page).toHaveURL(new RegExp(HOME_URL))
  })

  test('usuario sin sesión permanece en /login', async ({ page }) => {
    await page.goto('/')
    await clearSession(page)
    await page.goto(LOGIN_URL)
    await expect(page).toHaveURL(new RegExp(LOGIN_URL))
  })

  test('sesión expirada no redirige a /home', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('Session', JSON.stringify({
        access_token: 'expired-token',
        expires_in: 3600,
        expires_at: Date.now() - 1000  // expirado
      }))
    })
    await page.goto(LOGIN_URL)
    await expect(page).toHaveURL(new RegExp(LOGIN_URL))
  })
})

// ---------------------------------------------------------------------------
// Suite: Validaciones de campos
// ---------------------------------------------------------------------------

test.describe('Login — Validación de campos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL)
    await clearSession(page)
    await page.goto(LOGIN_URL)
  })

  test('submit con campos vacíos no llama a la API', async ({ page }) => {
    let apiCalled = false
    page.on('request', req => {
      if (req.url().includes('/api/token')) apiCalled = true
    })
    await page.click('[data-testid="submit"]')
    expect(apiCalled).toBe(false)
  })

  test('submit sin password no llama a la API', async ({ page }) => {
    let apiCalled = false
    page.on('request', req => {
      if (req.url().includes('/api/token')) apiCalled = true
    })
    await page.fill('[data-testid="email"]', 'user@test.com')
    await page.click('[data-testid="submit"]')
    expect(apiCalled).toBe(false)
  })

  test('submit sin email no llama a la API', async ({ page }) => {
    let apiCalled = false
    page.on('request', req => {
      if (req.url().includes('/api/token')) apiCalled = true
    })
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('[data-testid="submit"]')
    expect(apiCalled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Suite: Login exitoso
// ---------------------------------------------------------------------------

test.describe('Login — Flujo exitoso', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearSession(page)
  })

  test('login exitoso guarda token en localStorage', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          UserEmail: VALID_USER.email,
          UserId: 1
        })
      })
    })
    await page.route('**/api/Users/GetUserInfo', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: { Id: 1, Email: VALID_USER.email } })
      })
    })
    await page.route('**/api/Companies', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Data: [{ Id: 1, Name: 'Empresa Test' }] })
      })
    })

    await page.goto(LOGIN_URL)
    await fillAndSubmit(page, VALID_USER.email, VALID_USER.password)

    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('Session') || 'null'))
    expect(session).not.toBeNull()
    expect(session.access_token).toBe('test-access-token')
  })

  test('login exitoso redirige a /home', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' })
      })
    })
    await page.route('**/api/Users/GetUserInfo', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: {} }) })
    })
    await page.route('**/api/Companies', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [] }) })
    })

    await page.goto(LOGIN_URL)
    await fillAndSubmit(page, VALID_USER.email, VALID_USER.password)
    await expect(page).toHaveURL(new RegExp(HOME_URL))
  })

  test('botón submit muestra estado de carga durante request', async ({ page }) => {
    await page.route('**/api/token', async route => {
      await new Promise(r => setTimeout(r, 500))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' })
      })
    })
    await page.route('**/api/Users/GetUserInfo', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: {} }) })
    })
    await page.route('**/api/Companies', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: [] }) })
    })

    await page.goto(LOGIN_URL)
    await page.fill('[data-testid="email"]', VALID_USER.email)
    await page.fill('[data-testid="password"]', VALID_USER.password)
    await page.click('[data-testid="submit"]')

    const submitDisabled = await page.locator('[data-testid="submit"]').getAttribute('disabled')
    expect(submitDisabled).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Suite: Login fallido
// ---------------------------------------------------------------------------

test.describe('Login — Flujo de error', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearSession(page)
    await page.goto(LOGIN_URL)
  })

  test('credenciales inválidas muestra mensaje de error', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Credenciales inválidas' })
      })
    })
    await fillAndSubmit(page, 'wrong@test.com', 'wrongpass')
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('error de red muestra mensaje de error', async ({ page }) => {
    await page.route('**/api/token', route => route.abort())
    await fillAndSubmit(page, VALID_USER.email, VALID_USER.password)
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('después de error, el campo password se limpia', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) })
    })
    await fillAndSubmit(page, 'wrong@test.com', 'wrongpass')
    await expect(page.locator('[data-testid="password"]')).toHaveValue('')
  })

  test('después de error, el email se mantiene', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) })
    })
    await fillAndSubmit(page, 'user@test.com', 'wrongpass')
    await expect(page.locator('[data-testid="email"]')).toHaveValue('user@test.com')
  })

  test('no se guarda token en localStorage en caso de error', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) })
    })
    await fillAndSubmit(page, 'wrong@test.com', 'wrongpass')
    const session = await page.evaluate(() => localStorage.getItem('Session'))
    expect(session).toBeNull()
  })

  test('botón se rehabilita después de error', async ({ page }) => {
    await page.route('**/api/token', route => {
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) })
    })
    await fillAndSubmit(page, 'wrong@test.com', 'wrongpass')
    await expect(page.locator('[data-testid="submit"]')).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Suite: Interacciones de teclado
// ---------------------------------------------------------------------------

test.describe('Login — Interacciones de teclado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearSession(page)
    await page.goto(LOGIN_URL)
  })

  test('Enter en campo password hace submit', async ({ page }) => {
    let apiCalled = false
    await page.route('**/api/token', route => {
      apiCalled = true
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) })
    })
    await page.fill('[data-testid="email"]', VALID_USER.email)
    await page.fill('[data-testid="password"]', VALID_USER.password)
    await page.press('[data-testid="password"]', 'Enter')
    await page.waitForTimeout(500)
    expect(apiCalled).toBe(true)
  })

  test('Tab navega entre campos en orden correcto', async ({ page }) => {
    await page.focus('[data-testid="email"]')
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="password"]')).toBeFocused()
  })
})
