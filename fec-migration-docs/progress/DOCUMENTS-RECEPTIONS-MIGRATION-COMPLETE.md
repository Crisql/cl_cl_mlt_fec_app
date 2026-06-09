# documents/receptions — Migración Completa

**Fecha:** 2026-06-09
**Ruta:** `/documents/receptions`
**Angular legacy:** `pages/documents/documents-accepted/` (`DocumentsAcceptedComponent`)

> ⚠️ Este módulo es la búsqueda de documentos aceptados/recibidos.
> NO confundir con `/reception_documents` (formulario de recepción de XML — módulo independiente).

---

## ✅ Funcionalidad implementada (100%)

- Formulario de filtros con 13 campos (fechas, checkbox useXMLDates, mensaje, estado, emisor, clave, cédula, consecutivo, tipo doc, bandeja, moneda)
- Botón Hoy en ambas fechas
- Validación de búsqueda: sin clave → fechas requeridas; fechas futuras → bloqueo
- Búsqueda GET `api/Documents/SearchDocumentsAccepted` con todos los parámetros
- Tabla Tabulator server-side con 11 columnas (badges de estado, montos formateados)
- Botón "Más Información" — visible solo tras búsqueda sin cambios en form
- Botón "Descarga Masiva" — solo con permiso `F_CreateBulkDownloadOfDocuments`
- 10 acciones por fila con disponibilidad correcta según estado/permisos
- Panel lateral "Recepcionar Documento" (Previsualizar Aceptación)
- POST `api/Documents/ReceptMessageFromMailParser/` (ApiFEUrl) con editInfo
- PATCH `api/Documents/:id/Reprocess` (ApiFEUrl) — solo perm `Documents_Acceptance_Reprocess`
- Descarga PDF, XML Hacienda, XML Enviado
- Navegación a `/documents/receptions/:id/create` para SAP
- Carga inicial en paralelo: bandejas, monedas, info empresa
- Modal info, modal confirmación, modal error

---

## 📁 Archivos creados/modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `config/routes.rb` | Modificado | `get 'receptions'` dentro de `namespace :documents`; `reception_documents` restaurado como ruta separada |
| `app/controllers/documents/receptions_controller.rb` | Creado | `layout 'protected'`, `def index; end` |
| `app/views/documents/receptions/index.html.erb` | Creado | Vista completa — búsqueda de docs aceptados |
| `app/javascript/controllers/documents_receptions_controller.js` | Creado | Stimulus 1,037 líneas |
| `app/javascript/controllers/index.js` | Modificado | Import + register `documents-receptions` |
| `fec-migration-docs/comparisons/DOCUMENTS-RECEPTIONS-COMPLETE-ANALYSIS.md` | Creado | Análisis completo |
| `fec-ui-migration/tests/e2e/documents-receptions-complete-suite.spec.js` | Creado | Suite E2E |

---

## 📋 Suite de pruebas

**Archivo:** `fec-ui-migration/tests/e2e/documents-receptions-complete-suite.spec.js`
**Total:** ~40 pruebas cubriendo todos los flujos

Comando: `cd fec-ui-migration && npx playwright test tests/e2e/documents-receptions-complete-suite.spec.js --project=chromium`
