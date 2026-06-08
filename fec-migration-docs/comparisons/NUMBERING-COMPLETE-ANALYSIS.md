# Análisis Completo — Numeración (`/configurations/numbering`)

**Fecha:** 2026-06-08
**Migrado desde:** Angular `NumberingConfigComponent` (ruta `/numbering`)
**Migrado hacia:** Rails `configurations/numbering#index` (ruta `/configurations/numbering`)

---

## 1. Estructura de la página

La página tiene **dos secciones colapsables** (equivalente al `mat-accordion` de Angular):

| Sección | Estado inicial | Angular component |
|---|---|---|
| Numeración | Expandida | `NumberingComponent` |
| Numeración de Recepción | Colapsada | `ReceptionNumberingComponent` |

---

## 2. Sección Numeración

### 2.1 Carga de datos

Equivalente al `forkJoin` Angular:
- `GET /api/Numbering?companyId={id}` — lista de numeraciones
- `GET /api/Sucursal?companyId={id}` — lista de sucursales para mapeo y selects

**Mapeo de columnas (Angular `MapDisplayColumns`):**

| Campo API     | Columna tabla       | Transformación |
|---------------|---------------------|----------------|
| `Integration` | Tipo de Integración | 1 → Integrador, 2 → AppFE |
| `DocType`     | Tipo de Documento   | Valor directo (01, 02, ...) |
| `NextNumber`  | Número Siguiente    | Directo |
| `Obvs`        | Observación         | Directo |
| `SucursalId`  | Sucursal            | Mapeo a `SucursalNum` |
| `Terminal`    | Terminal            | Directo |
| `Active`      | Activo              | Badge Activo/Inactivo |

**Ignorados en tabla:** `Id`, `CompanyId`, `SucursalId` (raw), `Integration` (raw)

### 2.2 Botones de tabla

| Botón | Acción | Ícono |
|---|---|---|
| Editar | Abre panel lateral de edición | `edit` |

### 2.3 Panel Crear Numeración

Campos habilitados en creación: **todos**.
Campos deshabilitados en edición: `DocType`, `SucursalId`, `Terminal`.

| Campo | Tipo | Validación | Default |
|---|---|---|---|
| Número Siguiente | `number` | requerido, min 1 | 1 |
| Tipo de Documento | `select` | requerido | — |
| Sucursal | `select` | requerido | — |
| Terminal | `number` | requerido, min 0 | — |
| Observaciones | `text` | requerido | — |
| Tipo de Integración | `select` | requerido | — |
| Activo | `checkbox` / toggle | — | `true` |

**DocTypes disponibles:**

| Id | Nombre |
|----|--------|
| 01 | FE |
| 02 | ND |
| 03 | NC |
| 04 | TE |
| 08 | FEC |
| 09 | FEE |
| 10 | REP |

**Tipos de integración:**

| Id | Nombre |
|----|--------|
| 1 | Integrador |
| 2 | AppFE |

### 2.4 API calls Numeración

| Operación | Endpoint | Método | Payload |
|---|---|---|---|
| Crear | `/api/Numbering/` | POST | `{ Id: 0, CompanyId, NextNumber, DocType, SucursalId, Terminal, Obvs, Active, Integration }` |
| Editar | `/api/Numbering/` | PATCH | mismo payload en camelCase `{ id, companyId, nextNumber, ... }` |

---

## 3. Sección Numeración de Recepción

### 3.1 Carga de datos

- `GET /api/Numbering/GetReceptNumberingByCompany?companyId={id}`
- Sucursales reutilizadas del request inicial

**Mapeo de columnas:**

| Campo API     | Columna tabla       | Transformación |
|---------------|---------------------|----------------|
| `Integration` | Tipo de Integración | 1 → Integrador, 2 → AppFE |
| `NextNumber`  | Número Siguiente    | Directo |
| `SucursalId`  | Sucursal            | Mapeo a `SucursalNum` |
| `Terminal`    | Terminal            | Directo |
| `Obvs`        | Observación         | Directo |
| `Active`      | Activo              | Badge Activo/Inactivo |

**Ignorados:** `Id`, `CompanyId`, `SucursalId` (raw), `Integration` (raw), `Message`

### 3.2 Diferencias de comportamiento vs Numeración normal

| Aspecto | Numeración | Recepción |
|---|---|---|
| Crear — `NextNumber` | habilitado | **deshabilitado** |
| Editar — `NextNumber` | habilitado | **habilitado** |
| Editar — `DocType` | **deshabilitado** | (no existe campo) |
| Editar — `SucursalId` | **deshabilitado** | **deshabilitado** |
| Editar — `Terminal` | **deshabilitado** | **deshabilitado** |
| Payload extra | — | `Message: 1` siempre |

### 3.3 API calls Recepción

| Operación | Endpoint | Método |
|---|---|---|
| Crear | `/api/Numbering/PostReceptNumbering/` | POST |
| Editar | `/api/Numbering/PatchReceptNumbering/` | PATCH |

---

## 4. Manejo de errores

| Situación | Angular | Rails |
|---|---|---|
| Error GET inicial | `CLModalType.WARNING` | `showToast('...', 'warning')` |
| Error HTTP grave | `CLModalType.ERROR` | `showToast('...', 'error')` |
| Error POST/PATCH | `CLToastType.ERROR` | Modal de error (`#showErrorModal`) |
| Éxito POST/PATCH | `CLToastType.SUCCESS` | `showToast('...', 'success')` |

---

## 5. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Carga inicial forkJoin (3 GETs en paralelo) | ✅ | 100% | Promise.all |
| Toggle secciones colapsables | ✅ | 100% | |
| Tabla Numeración con todas las columnas | ✅ | 100% | Tabulator |
| Tabla Recepción con todas las columnas | ✅ | 100% | Tabulator |
| Badges de estado Activo/Inactivo | ✅ | 100% | |
| Botón editar por fila | ✅ | 100% | |
| Panel crear Numeración | ✅ | 100% | |
| Panel editar Numeración (campos disabled) | ✅ | 100% | |
| Panel crear Recepción (NextNumber disabled) | ✅ | 100% | |
| Panel editar Recepción (Sucursal/Terminal disabled) | ✅ | 100% | |
| Validaciones client-side | ✅ | 100% | |
| POST Numeración | ✅ | 100% | |
| PATCH Numeración (camelCase) | ✅ | 100% | |
| POST Recepción | ✅ | 100% | |
| PATCH Recepción | ✅ | 100% | |
| Manejo cl-message header | ✅ | 100% | |
| Sucursales populadas en selects | ✅ | 100% | |
| Toast éxito / Modal error | ✅ | 100% | |

---

## 6. Archivos generados

| Archivo | Descripción |
|---|---|
| `app/controllers/configurations/numbering_controller.rb` | Controlador Rails |
| `app/views/configurations/numbering/index.html.erb` | Vista ERB |
| `app/javascript/controllers/numbering_controller.js` | Stimulus controller |
| `config/routes.rb` | Ruta `get 'numbering'` en namespace configurations |
| `fec-ui-migration/tests/e2e/numbering-complete-suite.spec.js` | Suite Playwright (28 tests) |
