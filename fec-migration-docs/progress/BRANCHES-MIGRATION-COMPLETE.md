# Branches (Sucursal) — Migración Completa

**Fecha:** 2026-06-08
**Angular:** `/sucursal` → **Rails:** `/configurations/branches`

---

## ✅ Funcionalidad implementada (100%)

- Tabla Tabulator con todas las columnas: SucursalNum, Alias, Provincia, Cantón, Distrito, Barrio, Otras señas, Estado, Acciones
- Mapeo de IDs a nombres usando `Provinces.json` y `Country.json` (servidos desde `/public`)
- Badge Activo/Inactivo (convención CLAUDE.md)
- Tooltips en botones de acción (convención CLAUDE.md)
- Panel lateral crear sucursal
- Panel lateral editar sucursal (pre-carga datos)
- Cascada provincia → cantón → distrito → barrio (auto-selección del primer ítem)
- Autocomplete de barrio con filtrado por texto
- Solo-números en campos Teléfono y Fax
- Validaciones cliente (required, patrón número positivo, patrón email)
- `POST /api/Sucursal` para crear
- `PATCH /api/Sucursal` para editar
- Toast success en operaciones exitosas
- Modal de error en operaciones de escritura fallidas
- `cl-message` header decodificado en `#apiFetch`

---

## 📁 Archivos creados / modificados

| Archivo | Tipo |
|---|---|
| `config/routes.rb` | Ruta agregada |
| `app/controllers/configurations/branches_controller.rb` | Nuevo |
| `app/views/configurations/branches/index.html.erb` | Nuevo |
| `app/javascript/controllers/branches_controller.js` | Nuevo |
| `public/Country.json` | Nuevo (copiado de angular assets) |
| `public/Provinces.json` | Nuevo (copiado de angular assets) |
| `fec-migration-docs/comparisons/BRANCHES-COMPLETE-ANALYSIS.md` | Nuevo |
| `fec-ui-migration/tests/e2e/branches-complete-suite.spec.js` | Nuevo |

---

## 📋 Pruebas E2E

Suite: `fec-ui-migration/tests/e2e/branches-complete-suite.spec.js`

- Auth Guard (1 test)
- Carga inicial — tabla, badge, error GET (3 tests)
- Panel crear — apertura, título, país disabled, cancel, backdrop (5 tests)
- Validaciones (3 tests)
- Cascada de ubicación (4 tests)
- Crear sucursal — POST OK, POST error (2 tests)
- Editar sucursal — apertura, pre-carga, PATCH OK (3 tests)

**Total: 21 pruebas**
> El servidor Rails debe estar corriendo en `localhost:3000` para ejecutar: `cd fec-ui-migration && npx playwright test tests/e2e/branches-complete-suite.spec.js --project=chromium`

---

## 📋 Diferencias respecto al Angular legacy

| Aspecto | Angular | Rails |
|---|---|---|
| Formulario | `MatDialog` (625px alto) | Panel lateral deslizante (convención del proyecto) |
| Barrio | `mat-autocomplete` con `async pipe` | Dropdown custom sin dependencias |
| Overlay de carga | `OverlayService` global | Sin overlay (Tabulator loader interno) |
