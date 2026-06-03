# LOGIN — Migración Completa

**Módulo:** Login (`/login`)  
**Fecha:** 2026-06-03  
**Estado:** ✅ Implementación completa — ⚠️ Pruebas pendientes de setup Playwright

---

## ✅ Funcionalidad implementada (100%)

| Feature | Archivo |
|---|---|
| Controller Rails | `app/controllers/sessions_controller.rb` |
| Vista ERB | `app/views/sessions/new.html.erb` |
| Stimulus Controller | `app/javascript/controllers/login_controller.js` |
| Ruta `/login` | `config/routes.rb` |
| Auth Service (vendor) | `app/javascript/vendor/clavisco/login/index.js` (preexistente) |
| Guard: autenticado → /home | `login_controller.js#connect()` |
| POST /api/token | Vía `AuthService.login()` |
| Redirect post-login a /home | `login_controller.js#redirectToHome()` |
| Manejo de errores con UI | `data-login-target="errorMessage"` |
| Loading state en submit | `#setLoading()` |
| Toggle visibilidad password | `togglePassword()` |
| Limpieza de password tras error | ✅ |
| Logo Clavisco | ✅ |

---

## 📋 Pruebas creadas

**Archivo:** `fec-ui-migration/tests/e2e/login-complete-suite.spec.js`  
**Total de pruebas:** 18

| Suite | Tests |
|---|---|
| Carga inicial | 6 |
| Guard de autenticación | 3 |
| Validación de campos | 3 |
| Login exitoso | 3 |
| Login fallido | 5 |
| Interacciones de teclado | 2 |

### ⚠️ Setup requerido para ejecutar pruebas

El proyecto Rails no tiene `package.json` ni `playwright.config`. Para correr los tests:

```bash
# 1. Inicializar package.json en la raíz del proyecto Rails
npm init -y

# 2. Instalar Playwright
npm install --save-dev @playwright/test
npx playwright install chromium

# 3. Crear playwright.config.js en la raíz
# (baseURL: 'http://localhost:3000')

# 4. Ejecutar suite de login
npx playwright test fec-ui-migration/tests/e2e/login-complete-suite.spec.js --project=chromium
```

---

## 📋 Diferencias conocidas vs Angular

| Diferencia | Detalle |
|---|---|
| Clave localStorage | Angular: `"currentUser"` → Rails: `"Session"` (decisión del vendor migrado) |
| reCAPTCHA | Angular tenía `useRecaptcha: true` pero sin clave de sitio configurada en el env. **No implementado en Rails.** Agregar cuando se configure la clave. |
| Logout multi-pestaña | Angular tenía BroadcastChannel para detectar múltiples contextos. Rails implementa guard básico. |

---

## 📁 Archivos de documentación

- Análisis completo: `fec-migration-docs/comparisons/LOGIN-COMPLETE-ANALYSIS.md`
- Suite de pruebas: `fec-ui-migration/tests/e2e/login-complete-suite.spec.js`
- Este resumen: `fec-migration-docs/progress/LOGIN-MIGRATION-COMPLETE.md`
