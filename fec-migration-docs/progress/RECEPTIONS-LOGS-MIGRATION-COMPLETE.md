# MIGRATION-COMPLETE: documents/receptions/logs
**Angular route:** `/mailParser` → **Rails route:** `/documents/receptions/logs`
**Fecha:** 2026-06-16

---

## ✅ Funcionalidad implementada (100%)

- [x] Formulario de filtros con StartDate y EndDate (date inputs, default = hoy)
- [x] Botones "Hoy" para restablecer cada campo a la fecha actual
- [x] Validación de rango: ambas fechas ≤ hoy, StartDate ≤ EndDate
- [x] Modal de error informativo cuando el rango es inválido (usando `showAlert`)
- [x] Tabla Tabulator con paginación remote (`ajaxRequestFunc`)
- [x] Columnas: Fecha Log (formateada), Archivo, Remitente, Estado, Error, Bandeja de Entrada
- [x] Columnas ignoradas: Id, TrxDate, DocType
- [x] Formato de fecha `yyyy-MM-dd HH:mm:ss` per CLAUDE.md §5
- [x] Badge de estado genérico por valor de string
- [x] Botón "Descargar Email" por fila (ícono `mail`, tooltip)
- [x] Descarga de blob con extracción de filename desde Content-Disposition
- [x] Overlay loader tipo B (overlay service) para búsqueda y descarga
- [x] Toast success con datos / info sin datos / error en fallo
- [x] Paginación counter custom (`#totalRecords`) per CLAUDE.md §17
- [x] `#apiFetch` canónico con `Cl-Company-Id`, `cl-message` header, guard 204

## 📊 Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `app/controllers/documents/receptions_logs_controller.rb` | Creado |
| `app/views/documents/receptions_logs/index.html.erb` | Creado |
| `app/javascript/controllers/reception_logs_controller.js` | Creado |
| `app/javascript/controllers/index.js` | Modificado (import + register) |
| `config/routes.rb` | Modificado (nueva ruta dentro de namespace :documents) |
| `app/javascript/data/menu.js` | Modificado (route `/mailParser` → `/documents/receptions/logs`) |

## 📋 Tests

- Archivo: `fec-ui-migration/tests/e2e/receptions-logs-complete-suite.spec.js`
- Total: 18 pruebas
- Cobertura: carga inicial, botones Hoy, validación fechas, búsqueda, columnas, descarga, errores

## 📋 Diferencias con Angular

- Angular usaba `@clavisco/table` (cl-table). Rails usa Tabulator.
- Angular paginaba con `paginationType: 'dba'` (server). Rails usa `paginationMode: 'remote'` con `ajaxRequestFunc`. Los datos se traen todos de una sola llamada (la API no pagina en server), por lo que la paginación es local sobre el dataset completo.
- Fecha formateada con `DatePipe('M/d/yy, h:mm a')` en Angular → `yyyy-MM-dd HH:mm:ss` en Rails (per CLAUDE.md §5).
