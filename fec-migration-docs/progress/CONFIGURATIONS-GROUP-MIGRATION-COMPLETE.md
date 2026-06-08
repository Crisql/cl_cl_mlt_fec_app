# Configurations/Group — Migración Completa

**URL:** `/configurations/group`  
**Fecha:** 2026-06-08  
**Estado:** ✅ Completo

---

## ✅ Funcionalidad implementada (100%)

| Funcionalidad | Archivos |
|---|---|
| Ruta `GET /configurations/group` | `config/routes.rb` |
| Controller Rails | `app/controllers/configurations/group_controller.rb` |
| Vista ERB | `app/views/configurations/group/index.html.erb` |
| Stimulus controller | `app/javascript/controllers/group_controller.js` |
| Registro en index.js | `app/javascript/controllers/index.js` |

### Detalle por feature

- ✅ Carga inicial: GET `api/Group/GetGroupsByUser?companyId={id}`
- ✅ Formulario: Nombre (readonly), Descripción (editable), Formato de Impresión (readonly + botones sufijo)
- ✅ Tab "Usuarios de la Cuenta" — tabla Tabulator (UserName, Email)
- ✅ Tab "Compañías de la Cuenta" — tabla Tabulator (Identification, LegalName, ComercialName, Active con badge)
- ✅ Actualizar grupo: PATCH `api/Group` con FormData (Group JSON + archivo .rpt opcional)
- ✅ Subir archivo .rpt (validación de extensión, toast error si no es .rpt)
- ✅ Descargar formato: GET `api/Group/{groupId}/print-format` → Blob
- ✅ Restablecer formato: modal de confirmación → PATCH `api/Group/ResetPrintFormat?groupId={id}`
- ✅ Panel lateral "Crear Grupo": POST `api/Group`
- ✅ Control de permisos (Update, DownloadFEPrintFormat, Create)
- ✅ Header `cl-message` para errores de API (CLAUDE.md §6)
- ✅ Badges Activo/Inactivo en tabla compañías (CLAUDE.md §1)
- ✅ Botones icono + tooltip en inputs (CLAUDE.md §4)
- ✅ Panel lateral con animación deslizante (CLAUDE.md §8)
- ✅ Toast success para operaciones exitosas, modal de error para fallos de escritura (CLAUDE.md §9)
- ✅ Locale español en Tabulator, íconos Material en paginador (CLAUDE.md §10)

---

## 📋 Pruebas E2E

**Archivo:** `fec-ui-migration/tests/e2e/group-complete-suite.spec.js`  
**Tests creados:** 31  

Suites:
1. Auth guard (1 test)
2. Carga inicial (7 tests)
3. Tabs y tablas (7 tests)
4. Control de permisos (4 tests)
5. Actualizar grupo (3 tests)
6. Subir archivo .rpt (2 tests)
7. Restablecer formato (3 tests)
8. Panel crear grupo (5 tests)
9. Descargar formato (1 test)
10. Errores de API (1 test)

> Nota: Las pruebas requieren que el servidor Rails esté corriendo en `localhost:3000`.

---

## 📋 Diferencias conocidas con Angular

- Angular usaba `MatDialog` para el formulario "Crear Grupo"; Rails usa panel lateral deslizante (CLAUDE.md §8 — nunca formularios en modales).
- Angular usaba `@clavisco/table` (cl-table); Rails usa Tabulator.
- Angular tenía overlay global (`OverlayService`); Rails usa estados de carga nativos de Tabulator.

---

## Archivos creados/modificados

```
app/controllers/configurations/group_controller.rb        (nuevo)
app/views/configurations/group/index.html.erb             (nuevo)
app/javascript/controllers/group_controller.js            (nuevo)
app/javascript/controllers/index.js                       (modificado — registro)
config/routes.rb                                          (modificado — ruta)
fec-migration-docs/comparisons/CONFIGURATIONS-GROUP-COMPLETE-ANALYSIS.md  (nuevo)
fec-ui-migration/tests/e2e/group-complete-suite.spec.js   (nuevo)
```
