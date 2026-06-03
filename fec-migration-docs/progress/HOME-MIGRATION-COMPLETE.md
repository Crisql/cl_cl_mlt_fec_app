# HOME — Migración Completa

**Fecha:** 2026-06-03  
**Módulo:** `/home` (Dashboard principal)  
**Origen:** Angular `pages/home/home.component`  
**Destino:** Rails `HomeController` + Stimulus `home_controller`

---

## ✅ Funcionalidad implementada

| Funcionalidad | Estado |
|---|---|
| Ruta `GET /home` en routes.rb | ✅ |
| `HomeController#index` | ✅ |
| Vista `home/index.html.erb` con estructura de 6 cards | ✅ |
| Auth-guard (redirect a /login si sin sesión) | ✅ |
| Banner: carga desde `/banner.json` | ✅ |
| Banner: lógica de visibilidad con localStorage `BannerUser` | ✅ |
| Banner: expiración (no mostrar si cerrado y no expirado) | ✅ |
| Banner: botón cerrar (X) → ocultar + persistir | ✅ |
| Banner: click imagen → `window.open` nueva pestaña + persistir | ✅ |
| Registro de `HomeController` en `controllers/index.js` | ✅ |
| `public/banner.json` (datos del banner servidos estáticamente) | ✅ |
| 6 contenedores de gráficos con títulos correctos | ✅ |
| Placeholders visuales en los contenedores (sin Chart.js) | ✅ |

## ⏳ Pendiente (por instrucción del usuario)

| Funcionalidad | Motivo |
|---|---|
| Gráficos Chart.js (6 charts) | Usuario indicó "sin gráficos de momento" |
| Llamadas API a `/api/Documents/*` | Requieren charts implementados |
| Reload de charts al cambiar empresa (`storage` event) | Requiere charts |
| `GetCertExpireDateAlarm` | No migrado aún en ningún módulo |

---

## 📋 Pruebas

- **Archivo:** `fec-ui-migration/tests/e2e/home-complete-suite.spec.js`
- **Total de tests:** 20
- **Ejecutar:**
  ```bash
  cd fec-ui-migration
  npx playwright test home-complete-suite.spec.js --project=chromium
  ```

> **Nota:** Tests no ejecutados en sandbox (sin browser). Validación realizada mediante análisis estático:
> - Todos los `data-testid` del ERB coinciden con el spec
> - Todos los `data-home-target` del ERB coinciden con `static targets` del controller  
> - Las acciones `closeBanner` y `viewBanner` existen en el controller
> - Sintaxis JS validada con `node --check` (sin errores)

---

## 📁 Archivos modificados/creados

| Archivo | Operación |
|---|---|
| `app/controllers/home_controller.rb` | Creado |
| `app/views/home/index.html.erb` | Creado |
| `app/javascript/controllers/home_controller.js` | Creado |
| `app/javascript/controllers/index.js` | Modificado (registro HomeController) |
| `config/routes.rb` | Modificado (ruta `/home`) |
| `public/banner.json` | Creado |
| `fec-migration-docs/comparisons/HOME-COMPLETE-ANALYSIS.md` | Creado |
| `fec-ui-migration/tests/e2e/home-complete-suite.spec.js` | Creado |
| `fec-ui-migration/playwright.config.js` | Creado |
