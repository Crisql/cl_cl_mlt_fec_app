// @ts-check
/**
 * Suite E2E: Home — migración Angular → Rails
 * Cubre: auth-guard, banner, contenedores de gráficos (sin Chart.js)
 *
 * Prerequisitos:
 *   - Rails corriendo en http://localhost:3000
 *   - localStorage con sesión válida para pruebas autenticadas
 *   - localStorage con CurrentCompany válido
 */

const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:3000'
const HOME_URL = `${BASE_URL}/home`
const LOGIN_URL = `${BASE_URL}/login`

// Sesión mock válida para inyectar en localStorage
const MOCK_SESSION = {
  access_token: 'mock-token-123',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000, // 1 hora
  UserEmail: 'testuser@clavisco.com',
  UserId: '999'
}

const MOCK_COMPANY = {
  companyId: '1',
  companyName: 'Empresa Test'
}

// Helper: inyectar sesión válida antes de navegar a /home
async function injectAuth(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(({ session, company }) => {
    localStorage.setItem('Session', JSON.stringify(session))
    localStorage.setItem('CurrentCompany', JSON.stringify(company))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY })
}

// Helper: limpiar sesión
async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// ============================================================
// 1. AUTH GUARD
// ============================================================
test.describe('Home — Auth Guard', () => {
  test('redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await clearAuth(page)
    await page.goto(HOME_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('redirige a /login si sesión expirada', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    const expiredSession = { ...MOCK_SESSION, expires_at: Date.now() - 1000 }
    await page.evaluate((s) => localStorage.setItem('Session', JSON.stringify(s)), expiredSession)
    await page.goto(HOME_URL)
    await expect(page).toHaveURL(new RegExp('/login'))
  })

  test('permite acceso con sesión válida', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await expect(page).toHaveURL(HOME_URL)
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible()
  })
})

// ============================================================
// 2. CARGA INICIAL
// ============================================================
test.describe('Home — Carga inicial', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
  })

  test('la página carga correctamente', async ({ page }) => {
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible()
  })

  test('muestra el título de la página', async ({ page }) => {
    await expect(page).toHaveTitle(/Factura Electrónica/)
  })

  test('incluye el contenedor principal de gráficos', async ({ page }) => {
    await expect(page.locator('[data-testid="charts-container"]')).toBeVisible()
  })
})

// ============================================================
// 3. BANNER — Banner oculto por defecto (Visible: false en JSON)
// ============================================================
test.describe('Home — Banner (Visible: false)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    // Limpiar BannerUser para estado limpio
    await page.evaluate(() => localStorage.removeItem('BannerUser'))
    await page.goto(HOME_URL)
  })

  test('banner NO se muestra cuando Visible es false en el JSON', async ({ page }) => {
    const banner = page.locator('[data-testid="banner"]')
    await expect(banner).toBeHidden()
  })
})

// ============================================================
// 4. BANNER — Forzar visible = true para probar interacciones
// ============================================================
test.describe('Home — Banner (forzado visible)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.evaluate(() => localStorage.removeItem('BannerUser'))
    // Interceptar fetch del banner JSON para forzar Visible: true
    await page.route('**/banner.json', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          Data: [{
            Visible: true,
            ImgBanner: '/assets/banner_fe.png',
            ViewUrl: 'https://example.com',
            Message: 'Test banner'
          }]
        })
      })
    })
    await page.goto(HOME_URL)
  })

  test('banner se muestra cuando Visible es true', async ({ page }) => {
    await expect(page.locator('[data-testid="banner"]')).toBeVisible()
  })

  test('banner muestra la imagen', async ({ page }) => {
    const img = page.locator('[data-testid="banner-image"]')
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute('src', /banner/)
  })

  test('botón de cierre (X) está visible', async ({ page }) => {
    await expect(page.locator('[data-testid="banner-close"]')).toBeVisible()
  })

  test('cerrar banner lo oculta', async ({ page }) => {
    await page.locator('[data-testid="banner-close"]').click()
    await expect(page.locator('[data-testid="banner"]')).toBeHidden()
  })

  test('cerrar banner persiste en BannerUser localStorage', async ({ page }) => {
    await page.locator('[data-testid="banner-close"]').click()
    const bannerUser = await page.evaluate(() => {
      const raw = localStorage.getItem('BannerUser')
      return raw ? JSON.parse(raw) : null
    })
    expect(bannerUser).not.toBeNull()
    expect(Array.isArray(bannerUser)).toBe(true)
    expect(bannerUser.length).toBeGreaterThan(0)
    const entry = bannerUser[0]
    expect(entry).toHaveProperty('BannerVisibility', true)
    expect(entry).toHaveProperty('ExpiredDate')
  })

  test('click en imagen abre URL en nueva pestaña', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('[data-testid="banner-image"]').click()
    ])
    await newPage.waitForLoadState()
    expect(newPage.url()).toMatch(/example\.com/)
    await newPage.close()
  })

  test('click en imagen persiste en BannerUser localStorage', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('[data-testid="banner-image"]').click()
    ])
    await newPage.close()
    const bannerUser = await page.evaluate(() => {
      const raw = localStorage.getItem('BannerUser')
      return raw ? JSON.parse(raw) : null
    })
    expect(bannerUser).not.toBeNull()
    const entry = bannerUser[0]
    expect(entry).toHaveProperty('BannerVisibility', true)
  })
})

// ============================================================
// 5. BANNER — Persistencia: no mostrar si fue cerrado hoy
// ============================================================
test.describe('Home — Banner persistencia', () => {
  test('no muestra banner si usuario ya lo cerró (ExpiredDate futuro)', async ({ page }) => {
    await injectAuth(page)
    // Simular que el usuario cerró el banner, con expiración mañana
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const bannerUser = [{
      currentUser: 'testuser@clavisco.com',
      BannerVisibility: true,
      ExpiredDate: tomorrow.toISOString()
    }]
    await page.evaluate((bu) => localStorage.setItem('BannerUser', JSON.stringify(bu)), bannerUser)

    await page.route('**/banner.json', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          Data: [{ Visible: true, ImgBanner: '/assets/banner_fe.png', ViewUrl: 'https://example.com', Message: '' }]
        })
      })
    })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="banner"]')).toBeHidden()
  })

  test('muestra banner si ExpiredDate ya pasó', async ({ page }) => {
    await injectAuth(page)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const bannerUser = [{
      currentUser: 'testuser@clavisco.com',
      BannerVisibility: true,
      ExpiredDate: yesterday.toISOString()
    }]
    await page.evaluate((bu) => localStorage.setItem('BannerUser', JSON.stringify(bu)), bannerUser)

    await page.route('**/banner.json', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          Data: [{ Visible: true, ImgBanner: '/assets/banner_fe.png', ViewUrl: 'https://example.com', Message: '' }]
        })
      })
    })
    await page.goto(HOME_URL)
    await expect(page.locator('[data-testid="banner"]')).toBeVisible()
  })
})

// ============================================================
// 6. CONTENEDORES DE GRÁFICOS
// ============================================================
test.describe('Home — Contenedores de gráficos (placeholders)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
  })

  const charts = [
    { id: 'chart-card-1', title: 'Facturación últimos 30 días (CRC)' },
    { id: 'chart-card-2', title: 'Facturación últimas 12 semanas (CRC)' },
    { id: 'chart-card-3', title: 'Facturación últimos 12 meses (CRC)' },
    { id: 'chart-card-4', title: 'Top 10 clientes por venta' },
    { id: 'chart-card-5', title: 'Estado de envío de correos' },
    { id: 'chart-card-6', title: 'Cantidad de documentos por estado' },
  ]

  for (const chart of charts) {
    test(`contenedor "${chart.title}" está en el DOM`, async ({ page }) => {
      await expect(page.locator(`[data-testid="${chart.id}"]`)).toBeAttached()
    })

    test(`título "${chart.title}" es correcto`, async ({ page }) => {
      const card = page.locator(`[data-testid="${chart.id}"]`)
      await expect(card).toContainText(chart.title)
    })
  }
})

// ============================================================
// 7. EDGE CASES
// ============================================================
test.describe('Home — Edge cases', () => {
  test('sin CurrentCompany en localStorage, la página carga sin crash', async ({ page }) => {
    await injectAuth(page)
    await page.evaluate(() => localStorage.removeItem('CurrentCompany'))
    await page.goto(HOME_URL)
    // La página debe cargar (no lanzar error JS fatal)
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible()
  })

  test('no hay errores JS en consola al cargar la página', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await injectAuth(page)
    await page.goto(HOME_URL)
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})
