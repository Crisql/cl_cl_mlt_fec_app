# Análisis Completo — documents/receptions

**Ruta Rails:** `/documents/receptions`
**Componente Angular:** `pages/documents/documents-accepted/documents-accepted.component.ts`
**Controlador Rails:** `Documents::ReceptionsController`
**Stimulus:** `documents_receptions_controller.js` (`data-controller="documents-receptions"`)

> ⚠️ NOTA: Este módulo NO es el formulario de recepción de XML (`reception_documents`).
> Es la búsqueda/listado de documentos recibidos/aceptados (similar a documents-issued pero para recepciones).

---

## Estructura de la página

- Card superior: formulario de filtros (13 campos)
- Toolbar sobre tabla: botón "Más Información" (chart) + "Descarga Masiva" (permissioned)
- Tabla Tabulator server-side con paginación
- Panel lateral "Recepcionar Documento" (Previsualizar Aceptación)
- Modal info (texto genérico)
- Modal confirmación (Descarga Masiva)
- Modal error

---

## Campos del formulario de filtros

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| Fecha de Inicio | date + botón Hoy | hoy | |
| Fecha Final | date + botón Hoy | hoy | |
| ¿Fechas de Emisión? | checkbox | false | Cambia dateType: Recepción / Emisión |
| Petición (MessageType) | select | 0 (Todos) | 0/1/2/3 |
| Estado | select | 0 (Todos) | 0/1/2/3/4/5/7/8 |
| Nombre del Emisor | text | '' | |
| Clave | text | '' | Si se llena, fechas opcionales |
| Cédula Emisor | text maxlen 12 | '' | |
| Consecutivo Emisor | text | '' | |
| Tipo de documento | select | '01' (FE) | |
| Bandeja | select | '' | Cargado dinámicamente |
| Código de Moneda | text + autocomplete | '' | |
| Botón Consultar | button | — | Valida antes de buscar |

---

## Columnas de la tabla

| Campo API | Columna visible | Formato |
|---|---|---|
| FechaEmisionXML | Fecha de Emisión | yyyy-MM-dd HH:mm:ss |
| FechaEmisionDocClm | Fecha de Recepción | yyyy-MM-dd HH:mm:ss / 'N/A' |
| DocTypes | Tipo de Documento | mapeado (FE/ND/NC...) |
| NombreEmisor | Nombre Emisor | texto |
| NumeroCedulaEmisor | Cédula Emisor | texto |
| NumeroConsecutivoEmisor | Consecutivo Emisor | texto |
| MontoTotalImpuesto | Total Impuesto | es-CR |
| TotalFactura | Total Factura | es-CR |
| Statuscambio (Status) | Estado | badge |
| Mensajecambio | Mensaje | mapeado |
| ConsecutivoDoc | Num Doc Proveedor | texto |

---

## Badges de estado

| Status | Label | Color |
|---|---|---|
| 1 | Aceptado | verde |
| 2 | Procesando | amarillo |
| 3 | En Hacienda | amarillo |
| 4 | Rechazado | rojo |
| 5 | Error | amarillo |
| 6 | Reprocesar | amarillo |
| 7 | Obtenido del Correo | amarillo |
| 8 | Obtenido Correo Automático | amarillo |

---

## Acciones por fila

| Acción | Disponible cuando | API |
|---|---|---|
| Ver PDF de Recepción | HavePathReceptPDF == true | GET api/Documents/DownloadPDF?docId=X (ApiAppUrl) |
| Ver XML Resp Hacienda | Status == 1 o 4 | GET api/Documents/GetDocumentXMLAccepted?docId=X (ApiAppUrl) |
| Descargar XML Enviado | siempre | GET api/documents/receptions/:id/xml-sent (sin API header) |
| Enviar Aceptación | Status==7 && IsComplete && !SendReceptAndApInv | POST api/Documents/ReceptMessageFromMailParser/ (ApiFEUrl) |
| Previsualizar Aceptación | Status == 7 | Abre panel lateral |
| Obtenido del correo | Bandeja != null/'' | Modal info con Bandeja |
| Consultar Información | siempre | GET api/Documents/reception/:id/xml-response-message |
| Enviar a SAP | Status==1 && perm F_CreateAPInvoice && ConsecutivoDoc==0 && UseFactProv && DefaultTaxForXML | Navega a /documents/receptions/:id/create |
| Reprocesar | Status==4 && perm Documents_Acceptance_Reprocess | PATCH api/Documents/:id/Reprocess?isReceptionDocument=true (ApiFEUrl) |
| Detalle del Mensaje | siempre | Modal info con DetalleMensaje |

---

## Permisos

| Permiso | Efecto |
|---|---|
| F_CreateBulkDownloadOfDocuments | Muestra botón Descarga Masiva |
| F_CreateAPInvoice | Habilita acción Enviar a SAP |
| Documents_Acceptance_Reprocess | Habilita acción Reprocesar |

---

## Llamadas API — carga inicial

| Endpoint | Header API | Uso |
|---|---|---|
| GET api/Documents/GetBandejasReceptores?CompanyId=X | ApiAppUrl | Bandejas para select |
| GET api/Documents/GetCurrencyCodeAD/?companyId=X | ApiAppUrl | Autocomplete moneda |
| GET api/companies/:id | default | Info empresa (DefaultTaxForXML, SendReceptAndApInv, UseFactProv) |

---

## Validaciones de búsqueda

- Si Clave vacía y no hay fechas → modal info "fechas requeridas"
- Si fechas futuras o StartDate > EndDate → modal info "fechas inválidas"
- Si Clave tiene valor → se permite buscar sin fechas

---

## Panel "Recepcionar Documento"

Campos: DocName (readonly), Mensaje (select), CondicionImpuesto (select), TaxFactor (number), CodigoActividad (text), DetalleMensaje (textarea)

Al enviar → POST api/Documents/ReceptMessageFromMailParser/ con editInfo: true (ApiFEUrl)
