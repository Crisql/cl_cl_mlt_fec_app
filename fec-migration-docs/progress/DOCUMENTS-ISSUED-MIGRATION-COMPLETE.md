# DOCUMENTS-ISSUED — Migración Completa ✅

**Ruta Angular:** `documents/issued` → `DocumentsComponent`
**Ruta Rails:** `GET /documents/issued`
**Fecha:** 2026-06-09

---

## ✅ Funcionalidad implementada (100%)

- Formulario de filtros: 10 campos (StartDate, EndDate, Consecutivo, Status, Cedula, CodigoMoneda, Clave, Receptor, ConsecutivoFE, DocType)
- Botón "Hoy" en ambas fechas
- Parámetro URL `?clave=` pre-llena el campo Clave y dispara búsqueda
- Tabla Tabulator server-side: FechaFact, N° FE, N° Ref, Receptor, Estado (badge), Total
- Badges de estado coloreados (Aceptado, Procesando, En Hacienda, Rechazado, Error, Reprocesar, Cancelado)
- Paginación server-side (StartPost / StepPost)
- Contadores de estado en toolbar tras búsqueda
- Botón "Más Información" (chart) — visible solo tras búsqueda exitosa
- Botón "Descarga Masiva" — visible solo con perm `F_CreateBulkDownloadOfDocuments`
- Menú dropdown de opciones por fila (10 opciones)
- Ver PDF (base64 → nueva pestaña)
- Descargar PDF (base64 → saveAs)
- Ver XML Hacienda (solo Status 1 o 4)
- Descargar XML Hacienda (solo Status 1 o 4)
- Descargar Doc XML (bloqueado si Status=5)
- Modal Correos: tabla de correos + toggle "Otros destinatarios" + reenvío
- Modal Información: Clave, FechaEmision, error interno, error Hacienda (API si Status=4)
- Modal Chart (Chart.js doughnut con porcentajes por estado)
- Omitir Validaciones (solo Status=5) — confirmación + PATCH `api/Documents`
- Anulación Interna (solo DocType='08' y Status≠7) — confirmación + PATCH `api/Documents/SetDocStatusInternalCancelled`
- Reprocesar (solo Status=4 + perm `Documents_Emission_Reprocess`) — PATCH `api/Documents/{id}/Reprocess`
- Descarga Masiva — confirmación + POST `api/Report/BulkDownloadOfDocuments/`
- Modal de error para errores de escritura (API no-2xx)
- Toast de éxito para operaciones exitosas
- Modal de confirmación genérico reutilizable

---

## ✅ Pruebas creadas

Archivo: `fec-ui-migration/tests/e2e/documents-issued-complete-suite.spec.js`

**Total: 30 tests** que cubren:
- Auth guard (1)
- Carga inicial y defaults de formulario (5)
- Parámetro ?clave= (1)
- Botón Hoy (2)
- Búsqueda y datos (4)
- Permisos (2)
- Menú de opciones — condiciones por Status/DocType (7)
- Modal Correos (4)
- Modal Información (4)
- Omitir Validaciones (3)
- Reprocesar (2)
- Descarga Masiva (1)
- Errores de API (2)

> **Nota:** Las pruebas requieren `rails server` activo en localhost:3000.
> Ejecutar con: `npx playwright test documents-issued-complete-suite.spec.js --project=chromium`

---

## 📁 Archivos creados/modificados

| Archivo | Tipo |
|---|---|
| `app/controllers/documents/issued_controller.rb` | Nuevo |
| `app/views/documents/issued/index.html.erb` | Nuevo |
| `app/javascript/controllers/documents_issued_controller.js` | Nuevo |
| `config/routes.rb` | Modificado — namespace :documents |
| `app/javascript/controllers/index.js` | Modificado — registro DocumentsIssuedController |
| `fec-migration-docs/comparisons/DOCUMENTS-ISSUED-COMPLETE-ANALYSIS.md` | Nuevo |
| `fec-ui-migration/tests/e2e/documents-issued-complete-suite.spec.js` | Nuevo |

---

## 📋 Diferencias conocidas con Angular

| Angular | Rails | Notas |
|---|---|---|
| Chart usando `ChartModalDocumentsComponent` (ng-modal dedicado) | Chart.js inline en canvas | Misma funcionalidad, sin dependencia de componente Angular |
| Email table con `@clavisco/table` | Tabulator secundario instanciado dinámicamente | Misma UX |
| `saveAs` de `file-saver` | Blob + `<a download>` nativo | Sin dependencia extra |
| Overlay spinner global (`OverlayService`) | Tabulator `.alert()` y loading nativo | Spinner en la tabla durante fetch |
| `feToken` de `GetCurrentFESession()` | `''` (string vacío) | Rails no tiene CurrentFESession (ver STORAGE-KEY-MAPPING.md) |
