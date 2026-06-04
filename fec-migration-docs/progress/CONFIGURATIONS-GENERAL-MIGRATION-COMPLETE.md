# Migración Completa — configurations/general

**Fecha:** 2026-06-04
**URL:** `/configurations/general`
**Módulo Angular origen:** `pages/general-configs/general-configs.component`

---

## ✅ Funcionalidad implementada (10/10)

| Funcionalidad | Estado |
|---|---|
| Ruta `GET /configurations/general` | ✅ |
| Controlador Rails `Configurations::GeneralController` | ✅ |
| Vista ERB con estructura de dos secciones | ✅ |
| Stimulus controller `general-configs` registrado | ✅ |
| Carga de `GeneralConfigs` al iniciar | ✅ |
| Nombre de archivo extraído de ruta completa (`split('\\')`) | ✅ |
| Upload `.rpt` con validación de extensión | ✅ |
| `PATCH api/GeneralConfigs` con FormData multipart | ✅ |
| Carga de `CedulaProveedorSistemas` desde `api/settings` | ✅ |
| `PATCH api/settings` con `X-Authorization-FESync` | ✅ |
| Download `.rpt` como Blob (createObjectURL → click → revoke) | ✅ |
| Control de visibilidad por permisos (`SStore.get('Permissions')`) | ✅ |
| Overlay durante operaciones async | ✅ |
| Toast de success/warning/error | ✅ |

---

## 📋 Pruebas E2E creadas

**Archivo:** `fec-ui-migration/tests/e2e/configurations-general-complete-suite.spec.js`

**Total: 20 pruebas** en 7 suites:

| Suite | Pruebas |
|---|---|
| Carga inicial | 5 |
| Control de permisos | 5 |
| Upload y validación de archivo | 4 |
| Actualizar formato de impresión | 3 |
| Actualizar cédula | 3 |
| Download formato | 2 |
| Edge cases | 4 |

**Nota:** Las pruebas requieren el servidor Rails corriendo en `localhost:3000`.
Ejecutar con: `cd fec-ui-migration && npx playwright test tests/e2e/configurations-general-complete-suite.spec.js --project=chromium`

---

## 📁 Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `app/controllers/configurations/general_controller.rb` | ✅ Creado |
| `app/views/configurations/general/index.html.erb` | ✅ Creado |
| `app/javascript/controllers/general_configs_controller.js` | ✅ Creado |
| `app/javascript/controllers/index.js` | ✅ Modificado (registro) |
| `config/routes.rb` | ✅ Modificado (ruta `general`) |
| `fec-migration-docs/comparisons/CONFIGURATIONS-GENERAL-COMPLETE-ANALYSIS.md` | ✅ Creado |
| `fec-ui-migration/tests/e2e/configurations-general-complete-suite.spec.js` | ✅ Creado |

---

## 📋 Diferencias conocidas con Angular

- Angular usa `@clavisco/overlay` para el spinner; Rails usa un overlay DOM genérico (`#stimulus-overlay`) — misma UX, implementación diferente.
- Angular muestra toast via `CLToastType`; Rails usa `#toast-container` del layout protegido — comportamiento equivalente.
- No se replica `SetNameAction` (actualiza título en barra de menú Angular) — no aplica en Rails.

---

## 📋 Validaciones realizadas

- ✅ Ruby syntax OK (`general_controller.rb`, `routes.rb`)
- ✅ JS syntax OK (`general_configs_controller.js` — verificado con node stub)
- ✅ Targets: 8/8 declarados en `static targets`, usados en JS y presentes en ERB
- ✅ Data-actions: 5/5 apuntan a métodos públicos existentes en el controller
- ✅ `data-controller="general-configs"` en ERB coincide con `application.register('general-configs', ...)`
