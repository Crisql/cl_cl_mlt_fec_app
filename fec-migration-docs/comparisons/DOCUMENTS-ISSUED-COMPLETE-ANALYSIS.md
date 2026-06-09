# DOCUMENTS-ISSUED — Análisis Completo de Migración Angular → Rails

## Ruta Angular
`documents/issued` → `DocumentsComponent` (`pages/documents/documents/`)

---

## Estructura de la página

Una sola vista con dos secciones:
1. **Formulario de filtros** (card superior)
2. **Tabla de resultados** (card inferior) con toolbar de botones

---

## Formulario de filtros

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| StartDate | Date picker | Fecha actual | Botón "Hoy" a la derecha |
| EndDate | Date picker | Fecha actual | Botón "Hoy" a la derecha |
| Consecutivo | Text | '' | N° referencia SAP |
| Status | Select | `'99'` (Todos) | Ver lista DocStatus |
| Cedula | Text | '' | Cédula del receptor |
| CodigoMoneda | Text | '' | Código de moneda |
| Clave | Text | '' | Clave del comprobante |
| Receptor | Text | '' | Nombre del receptor |
| ConsecutivoFE | Text | '' | N° consecutivo FE |
| DocType | Select | `'01'` (FE) | Ver lista DocTypes |

### Botón de acción del formulario
- **Consultar** (`filter_alt`): llama `getDocuments(true)` — resetea página a 0

### Lógica adicional
- Si la URL tiene `?clave=xxx`, se pre-llena el campo Clave y se dispara búsqueda
- Cuando el formulario cambia (valueChanges), se oculta el botón "Más Información" (`btnChart = false`)

---

## Listas de opciones

### DocStatus (para select Estado)
| Id | Nombre |
|---|---|
| '1' | Aceptado |
| '2' | Procesando |
| '3' | En Hacienda |
| '4' | Rechazado |
| '5' | Error |
| '99' | Todos |

Default seleccionado: `docStatusList[5].Id` → `'99'` (Todos)

### DocTypes (para select Tipo de documento)
| Id | Nombre |
|---|---|
| '01' | FE |
| '02' | ND |
| '03' | NC |
| '04' | TE |
| '08' | FEC |
| '09' | FEE |
| '10' | REP |

Default seleccionado: `docTypeList[0].Id` → `'01'` (FE)

---

## Tabla de resultados

### Columnas visibles
| Campo API | Header tabla |
|---|---|
| FechaFact | Fecha Fact. |
| NumeroConsecutivo | N° FE |
| Consecutivo | N° Ref |
| RcprNombre | Receptor |
| StatusForTable | Estado |
| TotalComprobante | Total |

### Columnas ignoradas
`Id`, `MaxQtyRowsFetch`, `Clave`, `CodigoMoneda`, `DocType`, `ErrDetails`, `FechaEmision`, `Status`

### Transformaciones al mapear datos
- `CodigoMoneda`: normaliza `'₡'`/`'¢'` → `'₡'`; `'$'` → `'$'`; `'€'` → `'€'`
- `TotalComprobante`: `CodigoMoneda + total.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')`
- `StatusForTable`: ícono según `Status` (ver tabla de íconos abajo)
- `FechaFact`: formateado con `DatePipe` usando `DATE_FORMAT` (= `'yyyy-MM-dd'`)

### Íconos de estado
| Status | Texto | Icon | Color |
|---|---|---|---|
| 1 Aceptado | 'Aceptado' | thumb_up | #6BBC86 |
| 2 Procesando | 'Procesando' | warning | #FFC300 |
| 3 EnHacienda | 'EnHacienda' | warning | #FFC300 |
| 4 Rechazado | 'Rechazado' | thumb_down | #EC7063 |
| 5 Error | 'Error' | warning | #FFC300 |
| 6 Reprocesar | 'Reprocesar' | warning | #FFC300 |
| 7 Cancelado | 'Cancelado' | warning | #FFC300 |
| default | 'N/A' | warning | #FFC300 |

### Paginación
- `StartPos` (1-based al enviar a API), manejado con `SLStart` del estado de Tabulator
- `StepPos` = `itemsPeerPage` (default 10, opciones [5,10,15])
- `RecordsCount` = `MaxQtyRowsFetch` del primer registro
- Paginación server-side: Tabulator dispara `GetElementsRecords` al cambiar página

---

## Contadores de estado (mostrados como totales)
Obtenidos de `DocumentQtyList` en la respuesta API:
- `ContAcept` (Status=1), `ContInProcess` (Status=2), `ContHac` (Status=3)
- `ContFails` (Status=4), `ContError` (Status=5), `ContCancelled` (Status=7)

---

## Toolbar de la tabla

| Botón | Condición | Acción |
|---|---|---|
| Más Información (`query_stats`) | Solo si `btnChart=true` (hubo búsqueda exitosa y form no cambió) | Abre ChartModal |
| Descarga Masiva (`file_download`) | Solo si perm `F_CreateBulkDownloadOfDocuments` | Abre modal confirmación → POST `api/Report/BulkDownloadOfDocuments/` |

---

## Menú de acciones por fila (dropdown "Opciones")

| Opción | Action | Condición especial |
|---|---|---|
| Ver PDF | OPTION_1 | Ninguna |
| Descargar PDF | OPTION_2 | Ninguna |
| Ver XML (Resp Hacienda) | OPTION_3 | Solo si Status=1 o Status=4 |
| Descargar XML (Resp Hacienda) | OPTION_4 | Solo si Status=1 o Status=4 |
| Descargar Doc XML | OPTION_5 | Solo si Status != 5 (Error) |
| Correos | OPTION_6 | Ninguna |
| Consultar Información | OPTION_7 | Ninguna |
| Omitir Validaciones | OPTION_8 | Solo si Status=5 (Error) |
| Anulación Interna | OPTION_9 | Solo si Status!=7 Y DocType='08' (FEC) |
| Reprocesar | OPTION_11 | Solo si Status=4 (Rechazado) + perm `Documents_Emission_Reprocess` |

---

## Llamadas API

| Método | URL | Parámetros | Uso |
|---|---|---|---|
| GET | `api/documents` | StartDate, EndDate, DoctType, Status, Consecutivo, ConsecutivoFE, Receptor, Cedula, Clave, CodigoMoneda, StartPost, StepPost | Buscar documentos |
| GET | `api/Report/PrintInvoicePDF?id={Id}` | — | Ver PDF en nueva pestaña |
| GET | `api/Report/DownloadInvoicePDF?id={Id}` | — | Descargar PDF |
| GET | `api/Documents/PrintDocumentXML?docId={Id}` | — | Ver XML Hacienda en nueva pestaña |
| GET | `api/Documents/DownloadDocumentXML?docId={Id}` | — | Descargar XML Hacienda |
| GET | `api/Documents/GetXMLDoc?docId={Id}` | — | Descargar Doc XML |
| GET | `api/Email/GetOutgoingMails?docId={Id}` | — | Obtener correos enviados |
| POST | `api/Email/` | `{DocId, OtherEmails, MailTo, MailCC}` | Reenviar correo |
| POST | `api/Report/BulkDownloadOfDocuments/` | BulkDownloadModel | Descarga masiva |
| PATCH | `api/Documents` | `{docId, feToken}` | Omitir validaciones (reprocesar) |
| PATCH | `api/Documents/SetDocStatusInternalCancelled` | `{docId, feToken}` | Anulación interna |
| PATCH | `api/Documents/{id}/Reprocess?isReceptionDocument=false&companyId={id}` | — | Reprocesar |
| GET | `api/Documents/issued/{id}/xml-response-message` | — | XML resp Hacienda (InfoModal) |

---

## Paneles/Modales

### EmailModal (`email-modal-documents`)
- Tabla de correos enviados (`BandejaCorreoList`) con columnas: Fecha, Estado, Estado Doc, Último intento, Para, CC, Tipo, Detalles
- Botón "Otros destinatarios" → muestra form con campos `To` y `CC`
- Botón "Reenviar" → POST `api/Email/` con `{DocId, OtherEmails, MailTo, MailCC}`
- Botón "Cerrar"

### InfoModal (`info-modal-documents`)
- Muestra: Clave, FechaEmision, Error interno (si existe), Error Hacienda (si existe)
- Si Status=4 (Rechazado): llama `api/Documents/issued/{id}/xml-response-message` para poblar `ErrorRespHacienda`
- Botón "Cerrar"

### ChartModal (`chart-modal-documents`)
- Recibe porcentajes y cantidades de cada estado
- Solo se puede abrir si no hay NaN en los valores (todos > 0 después de una búsqueda exitosa)

### BulkDownloadModal (genérico `MatDialogComponent`)
- Confirmación con título y descripción
- Si confirma: POST a `api/Report/BulkDownloadOfDocuments/` con fechas del form y `KindOfDocuments='01'`

### SkipValidations + InternalCancelled — confirmación inline (Warning modal)
- Texto de confirmación descriptivo
- Confirmar → llamada API correspondiente → toast success → reload tabla

---

## Permisos relevantes
| Permiso | Uso |
|---|---|
| `F_CreateBulkDownloadOfDocuments` | Mostrar botón Descarga Masiva |
| `Documents_Emission_Reprocess` | Habilitar opción Reprocesar (validado en servicio) |

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Formulario de filtros (10 campos) | ❌ | 0% | |
| Botón "Hoy" en fechas | ❌ | 0% | |
| Parámetro URL ?clave= | ❌ | 0% | |
| Tabla Tabulator con 6 columnas | ❌ | 0% | |
| Íconos de estado en tabla | ❌ | 0% | |
| Paginación server-side | ❌ | 0% | |
| Contadores de estado | ❌ | 0% | |
| Botón "Más Información" (chart) | ❌ | 0% | |
| Botón "Descarga Masiva" (perm) | ❌ | 0% | |
| Ver PDF | ❌ | 0% | |
| Descargar PDF | ❌ | 0% | |
| Ver XML Hacienda | ❌ | 0% | |
| Descargar XML Hacienda | ❌ | 0% | |
| Descargar Doc XML | ❌ | 0% | |
| Modal Correos (tabla + reenvío) | ❌ | 0% | |
| Modal Info (clave, error, XML resp) | ❌ | 0% | |
| Omitir Validaciones | ❌ | 0% | |
| Anulación Interna (FEC) | ❌ | 0% | |
| Reprocesar | ❌ | 0% | |
| Modal Chart | ❌ | 0% | |
