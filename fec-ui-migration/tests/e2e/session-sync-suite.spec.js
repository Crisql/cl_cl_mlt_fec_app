// @ts-check
/**
 * Suite E2E: Session Sync (BroadcastChannel) — migración Angular → Rails
 *
 * Cubre los 5 flujos del análisis:
 *   A. Logout desde menú con pestaña única → modal "¿Está seguro?"
 *   B. Logout desde menú con múltiples pestañas → modal "Múltiples pestañas" + cierre en las demás
 *   C. Cierre silencioso al recibir CLOSE_SESSION (flujo receptor)
 *   D. Login en una pestaña → las demás navegan a /home y pierden empresa/permisos
 *   E. Navegación directa a /login autenticado → redirige a /home
 *
 * Nota: los escenarios B, C y D usan dos browser contexts (pestañas separadas)
 * para simular comunicación real via BroadcastChannel.
 *
 * Storage:
 *   localStorage.Session          → token de sesión
 *   sessionStorage.CurrentCompany → empresa seleccionada
 *   sessionStorage.Permissions    → array de strings
 */

const { test, expect, chromium } = require('@playwright/test')

const BASE_URL   = 'http://localhost:3000'
const HOME_URL   = `${BASE_URL}/home`
const LOGIN_URL  = `${BASE_URL}/login`
const PROT_URL   = `${BASE_URL}/configurations/branches`  // cualquier página protegida

const MOCK_SESSION = {
  access_token: 'mock-token-session-sync',
  token_type:   'Bearer',
  expires_at:   Date.now() + 3_600_000,
  UserEmail:    'testuser@clavisco.com',
  UserId:       'user-001',
}

const MOCK_COMPANY = {
  companyId:   '42',
  companyName: 'Empresa Test SA',
}

const MOCK_PERMISSIONS = ['M_Documents', 'M_Config']

// ---------------------------------------------------------------------------
// Helper: inyecta auth en una página (debe estar en LOGIN_URL para sessionStorage)
// ---------------------------------------------------------------------------
async function injectAuth(page) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: MOCK_PERMISSIONS })
}

// ---------------------------------------------------------------------------
// Helper: limpia storage en una página
// ---------------------------------------------------------------------------
async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// ---------------------------------------------------------------------------
// Flujo E — Navegación directa a /login estando autenticado
// ---------------------------------------------------------------------------
test.describe('Flujo E — Redirigir a /home si navega a /login autenticado', () => {
  test('debe redirigir automáticamente a /home', async ({ page }) => {
    await injectAuth(page)
    await page.goto(LOGIN_URL)

    // login_controller#connect() detecta sesión activa y redirige
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 5_000 })
    expect(page.url()).toContain('/home')
  })
})

// ---------------------------------------------------------------------------
// Flujo A — Logout con pestaña única → modal "¿Está seguro?"
// ---------------------------------------------------------------------------
test.describe('Flujo A — Logout pestaña única', () => {
  test('muestra modal de confirmación simple y redirige a /login', async ({ page }) => {
    await injectAuth(page)
    await page.goto(HOME_URL)
    await page.waitForLoadState('networkidle')

    // Abrir menú y hacer click en "Cerrar sesión"
    const logoutBtn = page.locator('[data-testid="menu-item-logout"]')
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 })
    await logoutBtn.click()

    // Debe aparecer el modal con "¿Está seguro?"
    const modal = page.locator('[role="dialog"], .cl-alert, .swal2-container')
    await expect(modal).toBeVisible({ timeout: 3_000 })

    const modalText = await modal.textContent()
    expect(modalText).toContain('Está seguro')
    expect(modalText).not.toContain('Múltiples pestañas')

    // Confirmar logout
    const confirmBtn = page.locator('button:has-text("Aceptar"), button:has-text("Confirmar"), button:has-text("Continuar")')
    await confirmBtn.first().click()

    await page.waitForURL(LOGIN_URL, { timeout: 5_000 })
    expect(page.url()).toContain('/login')

    // Storage debe estar limpio
    const session = await page.evaluate(() => localStorage.getItem('Session'))
    expect(session).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Flujo B — Logout con múltiples pestañas
// ---------------------------------------------------------------------------
test.describe('Flujo B — Logout con múltiples pestañas', () => {
  test('muestra modal "Múltiples pestañas" y cierra sesión en la segunda pestaña', async () => {
    const browser = await chromium.launch()

    // Contexto A (quien hace logout) y contexto B (la otra pestaña)
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      // Inyectar auth en ambas pestañas
      await injectAuth(pageA)
      await injectAuth(pageB)

      // Navegar ambas a una página protegida para que el BroadcastChannel esté activo
      await pageA.goto(HOME_URL)
      await pageB.goto(HOME_URL)
      await pageA.waitForLoadState('networkidle')
      await pageB.waitForLoadState('networkidle')

      // Pestaña A: click en logout
      const logoutBtnA = pageA.locator('[data-testid="menu-item-logout"]')
      await expect(logoutBtnA).toBeVisible({ timeout: 5_000 })
      await logoutBtnA.click()

      // Modal debe indicar múltiples pestañas
      const modal = pageA.locator('[role="dialog"], .cl-alert, .swal2-container')
      await expect(modal).toBeVisible({ timeout: 3_000 })

      const modalText = await modal.textContent()
      expect(modalText).toContain('Múltiples pestañas')

      // Confirmar en pestaña A
      const confirmBtn = pageA.locator('button:has-text("Aceptar"), button:has-text("Confirmar"), button:has-text("Continuar")')
      await confirmBtn.first().click()

      // Pestaña A debe ir a /login
      await pageA.waitForURL(LOGIN_URL, { timeout: 5_000 })
      expect(pageA.url()).toContain('/login')

      // Pestaña B debe ir a /login en silencio (flujo C)
      await pageB.waitForURL(LOGIN_URL, { timeout: 5_000 })
      expect(pageB.url()).toContain('/login')

      // Storage de pestaña B debe estar limpio
      const sessionB = await pageB.evaluate(() => localStorage.getItem('Session'))
      expect(sessionB).toBeNull()
    } finally {
      await ctxA.close()
      await ctxB.close()
      await browser.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Flujo C — Cierre silencioso al recibir CLOSE_SESSION
// ---------------------------------------------------------------------------
test.describe('Flujo C — Recepción de CLOSE_SESSION sin modal', () => {
  test('la pestaña receptora va a /login sin mostrar confirmación', async () => {
    const browser = await chromium.launch()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      await injectAuth(pageA)
      await injectAuth(pageB)

      await pageA.goto(HOME_URL)
      await pageB.goto(HOME_URL)
      await pageA.waitForLoadState('networkidle')
      await pageB.waitForLoadState('networkidle')

      // Simular CLOSE_SESSION directamente desde pestaña A (sin pasar por menú)
      await pageA.evaluate(() => {
        const ch = new BroadcastChannel('fe-app-channel')
        ch.postMessage({ type: 'CLOSE_SESSION', guid: 'external-guid-test' })
        ch.close()
      })

      // Pestaña B debe navegar a /login en silencio (sin dialog)
      await pageB.waitForURL(LOGIN_URL, { timeout: 5_000 })
      expect(pageB.url()).toContain('/login')

      // No debe haber modal abierto en pestaña B
      const modal = pageB.locator('[role="dialog"], .swal2-container')
      await expect(modal).toHaveCount(0)

      // Storage de B limpio
      const sessionB = await pageB.evaluate(() => localStorage.getItem('Session'))
      expect(sessionB).toBeNull()
    } finally {
      await ctxA.close()
      await ctxB.close()
      await browser.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Flujo D — Login en pestaña A → pestaña B navega a /home y pierde empresa
// ---------------------------------------------------------------------------
test.describe('Flujo D — OPEN_SESSION re-sincroniza otras pestañas', () => {
  test('la pestaña en página protegida navega a /home y pierde empresa/permisos', async () => {
    const browser = await chromium.launch()
    const ctxA = await browser.newContext()  // pestaña que inicia sesión
    const ctxB = await browser.newContext()  // pestaña ya autenticada en página protegida
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      // Pestaña B ya está autenticada con empresa y permisos
      await injectAuth(pageB)
      await pageB.goto(HOME_URL)
      await pageB.waitForLoadState('networkidle')

      // Simular OPEN_SESSION desde pestaña A (el login.interceptor lo enviaría)
      await pageA.goto(LOGIN_URL)
      await pageA.evaluate(() => {
        const ch = new BroadcastChannel('fe-app-channel')
        ch.postMessage({ type: 'OPEN_SESSION', guid: 'login-guid-test' })
        ch.close()
      })

      // Pestaña B debe navegar a /home (para re-sincronizar)
      await pageB.waitForURL(HOME_URL, { timeout: 5_000 })

      // CurrentCompany y Permissions deben haber sido eliminados de sessionStorage de B
      const { company, permissions } = await pageB.evaluate(() => ({
        company:     sessionStorage.getItem('CurrentCompany'),
        permissions: sessionStorage.getItem('Permissions'),
      }))
      expect(company).toBeNull()
      expect(permissions).toBeNull()
    } finally {
      await ctxA.close()
      await ctxB.close()
      await browser.close()
    }
  })
})
