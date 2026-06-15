# ANÁLISIS COMPLETO — documents/receptions/:docId/create

## Módulo Angular
`src/app/pages/documents/create-apinvoice/create-apinvoice.component.ts`  
Ruta Angular: `documents/receptions/:docId/create`  
Módulo Rails destino: `Documents::ReceptionsController#create`

---

## Estructura de la Página

### Componente raíz (`CreateApinvoiceComponent`)
Lee `docId` desde los route params y `shouldRecept` desde `sessionStorage.shouldRecept`.

Secciones:
1. **Acordeón "Recepción de Documentos"** — visible solo si `shouldRecept === 'true'`
   - Sub-componente `DocReceptionComponent`
2. **Tabs** (visibles después de cargar datos con `allstatus = true`):
   - `Cabecera` — siempre visible
   - `Líneas` — visible cuando `apInvoiceHeaderForm.valid`
   - `Otros cargos` — visible cuando `statusOC && apInvoiceHeaderForm.valid`

---

## APIS — Carga inicial (`forkJoin` paralelo)

| API | URL | Header API | Notas |
|-----|-----|-----------|-------|
| Accounts | `GET /api/Account/GetAccounts` | `ApiAppUrl` | Lista de cuentas SAP |
| DocXML | `GET /api/Documents/GetDocAPInvoiceInfoXML?docId={id}` | default | Info del XML del documento |
| DocChargeXML | `GET /api/Documents/GetDocAPInvoiceCharges?docId={id}` | default | Cargos del XML |
| TaxCode | `GET /api/Tax?CompanyId={id}` | `ApiAppUrl` | Códigos de impuesto SAP |
| Items | `GET /api/Item/GetItems` | `ApiAppUrl` | Lista de artículos SAP |
| CompanyInfo | `GET /api/companies/{id}` | default | Info compañía (tolerancias, DefaultTaxForXML) |
| Dimensions | `GET /api/Companies/GetDimensionsAndCntrCost` | `ApiAppUrl` | Dimensiones y centros de costo |
| Warehouse | `GET /api/Warehouse?CompanyId={id}` | `ApiAppUrl` | Lista de almacenes |
| Projects | `GET /api/Project` | `ApiAppUrl` | Lista de proyectos |
| Currencies | `GET /api/Companies/{id}/currencies` | default | Monedas de la compañía |

### Post-carga inicial (otra `forkJoin` en `loadInitialData`)

| API | URL | Header API |
|-----|-----|-----------|
| Suppliers | `GET /api/BusinessPartners` | `ApiAppUrl` |
| UDFs | `GET /api/Udf/GetConfiguredUdfs?companyId={id}&Category=true` | `ApiAppUrl` |
| DocTypeBase | `GET /api/Documents/GetDocTypeBase` | `ApiAppUrl` |

---

## APIS — Acciones del usuario

| Acción | Método | URL | Header API |
|--------|--------|-----|-----------|
| Autocomplete doc base | `GET /api/Documents/sap?docType={}&searchCriteria={}` | default | Debounce 260ms |
| Preview doc | `GET /api/Documents/GetDocumentInfoPreview?documentId={id}` | `ApiAppUrl` | Desde acordeón de recepción |
| Match automático | `POST /api/Documents/MatchAutomatic` | `ApiAppUrl` | Asigna líneas automáticamente |
| Crear factura SAP | `POST /api/documents/ap-invoices` | default | Sin recepción simultánea |
| Crear recepción+factura | `POST /api/documents/ap-invoices-with-recept` | default | Cuando `SendReceptAndApInv && shouldRecept` |
| Guardar mapeo moneda | `POST /api/Companies/{id}/currency-map` | default | Si moneda XML no está en compañía |

---

## Sección 1: Acordeón "Recepción de Documentos"

Visible: `sessionStorage.shouldRecept === 'true'`  
Sub-componente: `DocReceptionComponent` — recibe `childmenssaje = docId`

### Carga al init
`GET /api/Documents/GetDocumentInfoPreview?documentId={docId}` → pre-rellena el form

### Campos del formulario

| Campo | Tipo | Validaciones | Lógica |
|-------|------|-------------|--------|
| Mensaje | `<select>` | required | Opciones: 1=Aceptado, 2=Aceptar Parcialmente, 3=Rechazado |
| CondicionImpuesto | `<select>` | required | Opciones: 01–05. Si 03 o 05 → habilita TaxFactor |
| TaxFactor | `<input text>` | required solo si CondicionImpuesto=03/05 | Deshabilitado por default |
| CodigoActividad | `<input text>` | required, minLength(6), maxLength(6) | — |
| DetalleMensaje | `<textarea>` | required solo si Mensaje=2/3 | — |

### Botón
- **Previsualizar** → abre panel lateral con info del documento

### Eventos
- `CondicionImpuesto.change` → `LoadTaxFactor()` habilita/deshabilita TaxFactor
- `Mensaje.change` → `ValidateReceptData()` habilita/requiere DetalleMensaje
- `receptForm.valueChanges` → si válido, publica el form al servicio compartido

---

## Sección 2: Tab "Cabecera" (`HeaderComponent`)

### Validación de moneda antes de mostrar el tab
Si `xmlDoc.DocCur` no está en `companyCurrencies` → abre modal de selección de moneda.  
Si el usuario elige "Guardar mapeo" → `POST /api/Companies/{id}/currency-map`.

### Formulario Cabecera

| Campo | Tipo | Validaciones | Lógica |
|-------|------|-------------|--------|
| RefDocType | `<select>` | — | Opciones: de API `GetDocTypeBase`. Al cambiar: limpia RefDocEntry, habilita/deshabilita campo |
| RefDocEntry | `<input autocomplete>` | — | Busca con debounce 260ms: `GET /api/Documents/sap?docType={}&searchCriteria={}`. Si hay exactamente 1 resultado, lo selecciona automáticamente |
| Cerrar doc referencia | `<checkbox>` | — | Solo habilitado cuando hay `selectedDocEntry` |
| CardCode | `<input autocomplete>` | required | Filtra de lista de proveedores. Botón sufijo: "Refrescar Datos" (reload). Al seleccionar: calcula DocDueDate según ExtraDays del proveedor |
| DocDate | `<input date>` + Hoy | — | Pre-rellena desde `xmlDoc.TaxDate` |
| CardName | `<input text>` | — | Pre-rellena desde `xmlDoc.CardName` |
| DocDueDate | `<input date>` + Hoy | — | Calculado: TaxDate + ExtraDays del proveedor |
| NumAtCard | `<input text>` | — | Pre-rellena desde `xmlDoc.NumAtCard` |
| TaxDate | `<input date>` + Hoy | — | Pre-rellena desde `xmlDoc.TaxDate`. Al cambiar: recalcula DocDueDate |
| DocCur | `<input text>` | — | Readonly. Pre-rellena desde `xmlDoc.DocCur` |
| UDFs dinámicos | `<input text>` / `<select>` | según config | Renderizados dinámicamente desde API |

### Tabla de líneas en Cabecera
Tabla de solo lectura con las líneas agregadas en tab Líneas.  
Columnas: Código, Código desde XML, Detalle, Cuenta, Proyecto, Cantidad, Almacén, Precio, Descuento, Impuesto, Monto.

### Área de totales (lado derecho)
- SubTotal
- Total Otros Cargos
- Impuestos
- Descuento
- **Total** (bold)

Moneda mostrada: `DocCur` del documento

### Comentario
- `<textarea>` maxlength=254
- Contador: `N/254`

### Botones de acción
- **Crear borrador en SAP** — `disabled` si `apInvoiceHeaderForm.invalid` → `CreateAPInvoice(true)`
- **Crear en SAP** — `disabled` si `apInvoiceHeaderForm.invalid` → `CreateAPInvoice(false)`

### Lógica al cambiar de tab Cabecera → Líneas
- Se deshabilita `CardCode`
- Si `POCL24` tiene valor → deshabilita `RefDocType` y `RefDocEntry`

### Pre-relleno desde XML
```
DocDate  ← xmlDoc.TaxDate
CardName ← xmlDoc.CardName
NumAtCard← xmlDoc.NumAtCard
TaxDate  ← xmlDoc.TaxDate
Comments ← xmlDoc.Comments
DocCur   ← xmlDoc.DocCur
```
Si `xmlDoc.OthersRecepts` tiene campo `POCL24`:
- `RefDocType ← TipoDocBaseEnum.PurchaseOrder`
- `POCL24 ← valor del campo`

### PatchSupplier
Si el proveedor existe en la lista por `LicTradNum` → pre-rellena `CardCode` con `FullName`.  
Si no existe → modal informativo de que no existe en SAP.

---

## Sección 3: Tab "Líneas" (`LinesComponent`)

Visible solo cuando `apInvoiceHeaderForm.valid`.

### Tres tablas

#### Tabla XML (líneas del documento)
Columnas: Código, Detalle, Cantidad, Precio, Descuento, Impuesto, Monto Línea, Disponible  
Botón por fila: **Agregar** (`add_circle_outline`) — abre modal de selección de ítem

#### Tabla SAP (líneas del doc base si existe)
Columnas: Seleccionar, Código, Detalle, Cantidad, Precio, Descuento, Impuesto, Monto, Almacén

#### Tabla de líneas a SAP (líneas a crear en la factura)
Columnas: Código SAP, Código XML, Detalle (editable), Cuenta (dropdown), Proyecto (dropdown), Cantidad, Almacén, Precio, Descuento, Tarifa Impuesto (dropdown), Monto  
Botones por fila: **Eliminar** (delete), **Dimensiones** (add_circle_outline)

### Flujo de agregar línea
1. Click "Agregar" en línea XML → abre `MatDialogSeleccionComponent` (modal de selección de ítem + almacén + cantidad)
2. Al confirmar → crea `DocumentAPInvoiceLines` y lo agrega a tabla de líneas SAP
3. Actualiza disponible en tabla XML
4. Recalcula totales

### Agregar automático (match automático)
**Legacy (Angular — `LinesComponent.AddAutomaticLines`):**
- Lee `assets/data/CompanyUseMatchAuto.json` → si `UseMatchAuto: true`
- Llama `POST /api/Documents/MatchAutomatic` con líneas XML y datos del form
- Asigna automáticamente ítems, cuentas, almacenes, dimensiones

**Rails (implementado — `documents_reception_create_controller.js`):**
- Flag puente estático en `public/CompanyUseMatchAuto.json`, leído en la carga inicial
  por `#loadMatchAutoFlag()` → `#useMatchAuto`.
- Disparador en `switchTab()`: al abrir el tab **Líneas** por primera vez, si el flag
  está activo, se ejecuta `#addAutomaticLines()` una sola vez (guard `#matchAutoRan`).
- `#addAutomaticLines()` arma el payload `{ CardCode, CompanyId, POCL24, DocBaseType,
  DocumentsLines }` (con `#toMatchAutoLine()`), hace `POST /api/Documents/MatchAutomatic`
  vía `#apiFetch` (default `ApiAppUrl`), y por cada línea con `ItemCode` mapeado y
  `Available > 0` construye la `apLine` (item, cuenta por `FormatCode`, dimensiones
  validadas con `#resolveDimensionAuto()`, impuesto y totales), la agrega a la tabla SAP
  y pone `Available = 0` en la línea XML (y en los cargos del XML si corresponde).
- Resultado vacío → toast `info`; error de lectura → toast `error` (secciones 6/9 de CLAUDE.md).

### Eliminar línea
- Restituye disponible en tabla XML
- Si tenía `LineNum` de SAP → restituye cantidad en tabla SAP
- Recalcula totales

### Selección múltiple y confirmación de borrado (Rails)
- Tablas XML y SAP del tab Líneas con columna `rowSelection` (patrón de Otros Cargos).
- **Multi-agregar:** marcar varias líneas XML pendientes y presionar Agregar abre el panel
  una sola vez con artículo/almacén/cuenta/proyecto/impuesto comunes; la cantidad usada es
  el Disponible de cada línea (`#openItemSelectionForLines` / `confirmItemSelection`).
- **Multi-eliminar:** marcar varias líneas SAP y eliminar las borra juntas.
- **Confirmación:** todo borrado (1 o varias filas) en SAP y Otros Cargos pide confirmación
  warning (`confirm` del alerts service, `#confirmDelete`).

---

## Sección 4: Tab "Otros Cargos" (`OtherChargesComponent`)

Visible cuando `statusOC && apInvoiceHeaderForm.valid` (`statusOC = xmlDoc2.DocChargesXMLLines.length > 0`).

Funcionalidad similar a Líneas pero para cargos adicionales (fletes, seguros, etc.).

---

## Lógica de creación de factura (`CreateAPInvoice`)

### Validaciones previas
1. `docTypeXML === DocTypes.Factura` (1) — solo para facturas
2. UDFs dinámicos válidos
3. Total dentro del rango de tolerancia vs XML (`TotalIsValid`)
4. `apInvoiceHeaderForm.valid`
5. Si `receptAndCreateApInvoice` → verificar que `receptForm` no sea null y sea válido

### Flujo de envío
- Si `SelectedCompany.SendReceptAndApInv && shouldReceptDocument`:
  - `POST /api/documents/ap-invoices-with-recept` → `CreateReceptAndApInv`
- En caso contrario:
  - `POST /api/documents/ap-invoices` → `CreateAPInvoice`
- Al éxito → modal con número de documento → navegar de vuelta a lista

### Return URL
- Por default: `/documents/receptions`
- Si `urlToReturnType` en queryParams → `/documents/gt/receptions`

---

## Modal de selección de moneda
Aparece cuando `xmlDoc.DocCur` no existe en `companyCurrencies`.  
- `<select>` de monedas disponibles
- Checkbox "Guardar mapeo"
- Al confirmar → aplica moneda seleccionada al XML y opcionalmente guarda el mapeo

---

## Modal de tolerancia
Aparece cuando la moneda del doc no tiene tolerancia configurada Y hay otras tolerancias.  
Permite seleccionar una tolerancia alternativa para validar el total.

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Ruta `/documents/receptions/:id/create` | ❌ No existe | 0% | Hay que agregar |
| Controller action `create` | ❌ No existe | 0% | |
| Vista base con tabs | ❌ No existe | 0% | |
| Acordeón Recepción (shouldRecept) | ❌ No existe | 0% | |
| Form Cabecera | ❌ No existe | 0% | |
| Autocomplete proveedores | ❌ No existe | 0% | |
| Autocomplete doc base | ❌ No existe | 0% | |
| UDFs dinámicos | ❌ No existe | 0% | |
| Tabla de líneas XML | ❌ No existe | 0% | |
| Tabla de líneas SAP | ❌ No existe | 0% | |
| Tabla de líneas a SAP | ❌ No existe | 0% | |
| Totales dinámicos | ❌ No existe | 0% | |
| Tab Líneas con match automático | ✅ Implementado | 100% | `#addAutomaticLines()` + flag `public/CompanyUseMatchAuto.json`; cubierto por suite E2E «Match automático de líneas» |
| Tab Otros Cargos | ❌ No existe | 0% | |
| Modal selección moneda | ❌ No existe | 0% | |
| Modal tolerancia | ❌ No existe | 0% | |
| Crear borrador en SAP | ❌ No existe | 0% | |
| Crear en SAP | ❌ No existe | 0% | |
| Crear recepción+factura | ❌ No existe | 0% | |
| Registro en controllers/index.js | ❌ No existe | 0% | |
