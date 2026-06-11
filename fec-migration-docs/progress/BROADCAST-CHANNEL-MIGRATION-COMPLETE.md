# BroadcastChannel / Session Sync — Migración Completa

**Módulo:** Sincronización entre pestañas (cross-cutting)
**Fecha:** 2026-06-11
**Equivalente Angular:** `BroadcastChannelService` + `LogoutService` + `LogoutGuard`

---

## ✅ Funcionalidad implementada

| Funcionalidad | Estado |
|---|---|
| Canal `fe-app-channel` con GUID por pestaña | ✅ |
| `initSessionSync()` — idempotente, se llama desde Stimulus | ✅ |
| `notifySessionOpened()` — postMessage OPEN_SESSION | ✅ |
| `notifySessionClosed()` — postMessage CLOSE_SESSION | ✅ |
| `thereAreMultipleContexts()` — Promise<boolean> con timeout 250 ms | ✅ |
| `clearSession()` — limpieza centralizada de localStorage + sessionStorage | ✅ |
| Handler OPEN_SESSION → limpiar sessionStorage + redirect /home | ✅ |
| Handler CLOSE_SESSION → clearSession + redirect /login (silencioso) | ✅ |
| Handler VERIFY_MULTIPLE_CONTEXTS → responde MULTIPLE_CONTEXT_VERIFIED | ✅ |
| Handler MULTIPLE_CONTEXT_VERIFIED → resuelve promesa de verificación | ✅ |
| `session_sync_controller.js` montado en layout `protected` | ✅ |
| `session_sync_controller.js` montado en layout `application` (login) | ✅ |
| `login_controller` notifica `notifySessionOpened()` tras login OK | ✅ |
| `menu_controller#logout()` con detección de múltiples pestañas | ✅ |
| Modal diferenciado: "Múltiples pestañas" vs "¿Está seguro?" | ✅ |
| `notifySessionClosed()` solo cuando hay múltiples pestañas | ✅ |
| Redirigir a /home si navega directamente a /login autenticado | ✅ (ya existía) |
| `LogoutService` flags | N/A — innecesario en MPA |

---

## 📋 Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `app/javascript/vendor/clavisco/session-sync/index.js` | Creado |
| `app/javascript/controllers/session_sync_controller.js` | Creado |
| `app/javascript/controllers/index.js` | Modificado (import + register) |
| `app/views/layouts/protected.html.erb` | Modificado (data-controller) |
| `app/views/layouts/application.html.erb` | Modificado (data-controller en body) |
| `app/javascript/controllers/login_controller.js` | Modificado (notifySessionOpened) |
| `app/javascript/controllers/menu_controller.js` | Modificado (logout reescrito) |
| `fec-ui-migration/tests/e2e/session-sync-suite.spec.js` | Creado |

---

## 🧪 Suite E2E

**Archivo:** `fec-ui-migration/tests/e2e/session-sync-suite.spec.js`
**Pruebas:** 5 escenarios

| # | Flujo | Descripción |
|---|---|---|
| E | Pestaña única | Navegar a /login autenticado → redirige a /home |
| A | Logout pestaña única | Modal "¿Está seguro?" → confirmar → /login |
| B | Logout múltiples pestañas | Modal "Múltiples pestañas" → confirmar → ambas en /login |
| C | CLOSE_SESSION recibido | Pestaña receptora va a /login sin modal |
| D | OPEN_SESSION recibido | Pestaña protegida navega a /home y pierde empresa/permisos |

---

## 📋 Diferencias conocidas con Angular

1. **`LogoutService` no migrado** — en MPA los flujos son imperativos, no hace falta máquina de estado.
2. **`matDialog.closeAll()`** — al recibir CLOSE_SESSION no se cierran paneles laterales abiertos. Edge case documentado en la sección de riesgos del análisis.
3. **GUID por recarga** — en Angular el GUID era persistente en el singleton; en Rails se recrea en cada carga de página. Válido porque la verificación ocurre en los 250 ms previos a redirigir.

---

## ⚙️ Para ejecutar los tests

```bash
npx playwright test session-sync-suite.spec.js --project=chromium
```
