# CONNECTIONS — Migración Completa

**Fecha:** 2026-06-05  
**URL Angular:** `/configuration/connections`  
**URL Rails:** `/configurations/connections`

---

## ✅ Funcionalidad implementada (100%)

| Funcionalidad | Estado |
|---|---|
| Lista con tabla (ID, Servidor, Usuario, Motor DB, URL API, URL Crystal API) | ✅ |
| Búsqueda por Server y APIUrl | ✅ |
| Botón "Crear" visible solo con permiso `Configurations_Connections_Create` | ✅ |
| Botón "Editar" por fila visible solo con permiso `Configurations_Connections_Update` | ✅ |
| Toast INFO cuando intenta editar sin permiso | ✅ |
| Estado vacío y estado de carga | ✅ |
| Formulario crear con 12 campos | ✅ |
| Formulario editar: carga datos desde API | ✅ |
| DBPass requerido solo en crear | ✅ |
| Toggle visibilidad de contraseña | ✅ |
| Validaciones de campos requeridos con toast WARNING | ✅ |
| Modal WARNING + redirect si no tiene permiso al entrar al form | ✅ |
| POST /api/Connections para crear | ✅ |
| PATCH /api/Connections para actualizar | ✅ |
| Toast SUCCESS + redirect a lista al guardar | ✅ |
| Modal ERROR en fallos de API | ✅ |
| Ruta del menú corregida (singular → plural) | ✅ |

---

## 📊 Pruebas

- **Archivo:** `fec-ui-migration/tests/e2e/connections-complete-suite.spec.js`
- **Total:** 22 pruebas
- **Suites:**
  1. Lista — Carga inicial (6 tests)
  2. Lista — Búsqueda (2 tests)
  3. Lista — Acciones (4 tests)
  4. Formulario — Crear (6 tests)
  5. Formulario — Editar (5 tests)

---

## 📁 Archivos creados / modificados

| Archivo | Tipo |
|---|---|
| `app/controllers/configurations/connections_controller.rb` | Nuevo |
| `app/views/configurations/connections/index.html.erb` | Nuevo |
| `app/views/configurations/connections/new.html.erb` | Nuevo |
| `app/views/configurations/connections/edit.html.erb` | Nuevo |
| `app/views/configurations/connections/_form.html.erb` | Nuevo |
| `app/javascript/controllers/connections_controller.js` | Nuevo |
| `app/javascript/controllers/connection_form_controller.js` | Nuevo |
| `app/javascript/controllers/index.js` | Modificado (registro de controllers) |
| `config/routes.rb` | Modificado (3 rutas añadidas) |
| `app/javascript/controllers/menu_controller.js` | Modificado (fix typo en ruta) |
| `fec-migration-docs/comparisons/CONNECTIONS-COMPLETE-ANALYSIS.md` | Nuevo |
| `fec-ui-migration/tests/e2e/connections-complete-suite.spec.js` | Nuevo |

---

## 📋 Diferencias con Angular

- Angular usaba `/configuration/connections` (singular) — Rails usa `/configurations/connections` (plural, consistente con el resto del app). El menú se corrigió en este proceso.
- Angular renderizaba la tabla con `@clavisco/table` (cl-table). Rails renderiza HTML nativo con Stimulus.
- Angular usaba `MatDialog` para el modal de permisos. Rails usa un modal HTML inline.

