# Roles — Migración Completa Angular → Rails

## Resumen

| | |
|---|---|
| **Ruta legacy** | `/Rol` |
| **Ruta nueva** | `/configurations/roles` |
| **Fecha** | 2026-06-04 |

## ✅ Funcionalidad implementada (100%)

| Funcionalidad | Archivo |
|---|---|
| Ruta GET /configurations/roles | `config/routes.rb` |
| Controller Rails | `app/controllers/configurations/roles_controller.rb` |
| Vista ERB (tabla + botón Nuevo + modales) | `app/views/configurations/roles/index.html.erb` |
| Stimulus: carga GET api/Rol/GetRoles | `app/javascript/controllers/roles_controller.js` |
| Stimulus: tabla con iconos activo/inactivo | idem |
| Stimulus: botón Nuevo → modal crear | idem |
| Stimulus: botón Editar por fila → modal editar | idem |
| Stimulus: protección OWNER (toast info, no abre modal) | idem |
| Stimulus: POST api/Rol crear (Id=0, Active=true, GroupId=0) | idem |
| Stimulus: PATCH api/Rol editar | idem |
| Stimulus: toast éxito (verde) | idem |
| Stimulus: modal de error en fallos de API | idem |
| Registro del controller en index.js | `app/javascript/controllers/index.js` |

## ✅ Pruebas creadas

- **Archivo:** `fec-ui-migration/tests/e2e/roles-complete-suite.spec.js`
- **Total de pruebas:** 27 pruebas en 7 bloques
  - Auth Guard (3)
  - Carga inicial (7)
  - Crear rol (6)
  - Editar rol (3)
  - Rol OWNER protegido (1)
  - Validaciones (3)
  - Errores de API (2)
- **Estado:** Pendientes de ejecución con servidor Rails activo (localhost:3000)

## 📋 Diferencias con Angular

- La tabla usa HTML/CSS nativo en lugar de `<cl-table>` (vendor component)
- El modal es inline en la vista ERB en lugar de `MatDialog`
- El toast usa implementación propia en lugar de `AlertsService`

## 📁 Archivos creados/modificados

```
A  app/controllers/configurations/roles_controller.rb
A  app/views/configurations/roles/index.html.erb
A  app/javascript/controllers/roles_controller.js
M  app/javascript/controllers/index.js          (+2 líneas)
M  config/routes.rb                             (+1 línea)
A  fec-migration-docs/comparisons/ROLES-COMPLETE-ANALYSIS.md
A  fec-migration-docs/progress/ROLES-MIGRATION-COMPLETE.md
A  fec-ui-migration/tests/e2e/roles-complete-suite.spec.js
```
