# Create Document — Análisis Completo para Migración Angular → Rails

> Componente legacy: `legacy/web_angular/src/app/pages/documents/create-document/`
> Sub-dialogs: `add-item/`, `term-suc-modal/`
> Servicios: `documents.service.ts`, `customer.service.ts`, `product.service.ts`, `cabys.service.ts`, `numbering.service.ts`, `companies.service.ts`, `json-data.service.ts`
> Enums/Constantes: `core/enums/enums.ts`, `models/constants.ts`
>
> Este documento describe FIELMENTE el comportamiento del componente legacy. Nada está implementado todavía en Rails (ver matriz final, todo al 0%).

---

## 1. Overview

`CreateDocumentComponent` es una pantalla única reutilizada para crear **cinco tipos de documento electrónico** de Hacienda Costa Rica. El tipo se recibe por ruta: `this.activatedRoute.snapshot.paramMap.get('docType')`.

| Código (`DocTypesString`) | Constante | Título de página | `SetNameAction` |
|---|---|---|---|
| `01` | `FE` | Factura Electrónica | `Facturación - Factura Electrónica` |
| `02` | `ND` (enum dice `ND = '02'`) | **Nota de Crédito Electrónica** | `Facturación - Nota de Crédito Electrónica` |
| `03` | `NC` (enum dice `NC = '03'`) | **Nota de Débito Electrónica** | `Facturación - Nota de Débito Electrónica` |
| `08` | `FEC` | Factura Electrónica de Compra | `Facturación - Factura Electrónica de Compra` |
| `10` | `REP` | Recibo Electrónico de Pago | `Facturación - Recibo Electronico de Pago` |

> **⚠️ Trampa de naming**: en `enums.ts` el enum es `ND = '02'` y `NC = '03'`, pero el `switch` de `SetDocTypeString()` asigna el título `'Nota de Débito Electrónica'` cuando `docType === DocTypesString.ND` (`'02'`) y `'Nota de Crédito Electrónica'` en otro caso. **El código pone los títulos al revés respecto al nombre del enum**: `'02'` (`ND`) muestra "Nota de Débito" y `'03'` (`NC`) muestra "Nota de Crédito". `DocTypes` (constante para el dropdown) etiqueta `'02' → 'ND'` y `'03' → 'NC'`. Hay que replicar **exactamente** este comportamiento (no "corregirlo").

El comportamiento se ramifica por `docType` en `SetDocTypeString()`, que **recrea el formulario** (`this.documentForm = this.CreateDocumentForm()`) y luego aplica validadores/listas específicas. El dropdown de tipo de documento (`DocType`) está **deshabilitado** (solo lectura), así que el tipo se fija por ruta y no cambia en pantalla.

`docTypeList` (dropdown DocType) = constante `DocTypes`: `01 FE, 02 ND, 03 NC, 04 TE, 08 FEC, 09 FEE, 10 REP`.

---

## 2. Estructura de página

Toolbar superior (botones alineados a la derecha, `fxLayoutAlign="flex-end"`):
1. **`{{btnAction}}`** (Crear/Reenviar) — submit, `[disabled]="documentForm.invalid"`, tooltip = `showErrorMessage()`.
2. **Terminales y Sucursales** — abre `TermSucModalComponent`, tooltip = `showSucuAndTerErrorMessage()`.
3. **Colapsar** — `accordion.closeAll()`.

Cuerpo = `<mat-accordion multi>` con paneles de expansión (`mat-expansion-panel`), en este orden:

1. **Datos Generales** — Fecha, Tipo de Documento, Condición de Venta, Detalle de Condición de la Venta (oculto si REP), Moneda, Tipo de Cambio, Plazo del Crédito (oculto si REP), Código de la Actividad Económica del `{{labelCodigoActividad}}` (autocomplete).
2. **`{{titleAccDatosCliente}}`** ("Datos del Cliente", o "Datos del Emisor" si FEC) — Cliente (+ botón buscar), Tipo de Identificación, Identificación, Código de Actividad Económica (oculto si REP), Registro Fiscal 8707 (solo FEC), Otras Señas Extranjero.
3. **Datos de Ubicación** (`*ngIf="!isDocTypeREP()"`) — Provincia, Cantón, Distrito, Barrio (autocomplete), Dirección.
4. **Datos de Contacto** — E-Mail (un input simple si `docType != '08'`; lista multi-email con add/remove si `docType == '08'`), Teléfono (oculto si REP), E-Mail de Copia (oculto si REP).
5. **Datos de Referencia** — `FormArray InfReference` (1..10 nodos), cada nodo con Tipo de Documento, Detalle Tipo, Número, Fecha de Emisión (+ botón "Hoy"), Código, Detalles de código, Razón, botón eliminar. Botón "Agregar referencia".
6. **`{{isDocTypeREP()?"Informacion de pago":"Datos de Ítems"}}`** — leyenda "* Es una regalía", botón "Agregar Ítems"/"Agregar pago", tabla `cl-table` (`tblItems`) con botones Actualizar/Eliminar por fila.
7. **Datos de Pago** — `FormArray MedioPago` (1..4 nodos): Medio de Pago, Detalle de medio pago, Monto, botón eliminar. Tabla total si hay >1 medio. Botón "Agregar Medio de Pago".

Pie de página: tabla de totales (SubTotal, Impuestos, Descuento, Total) con símbolo de moneda.

---

## 3. Lista COMPLETA de campos — `CreateDocumentForm()`

Todos los campos son del `documentForm` salvo los `FormArray`. Defaults y validadores tal cual el código.

### Controles raíz

| Campo | Tipo | Default | Validadores (al crear) | Disabled | DocTypes que lo muestran |
|---|---|---|---|---|---|
| `FechaFact` | text (fecha hoy `yyyy-MM-dd`) | `datePipe.transform(new Date(),'yyyy-MM-dd')` | `required` | **Sí (disabled:true)** | Todos |
| `DocType` | select | `this.docType` | `required` | **Sí (disabled:true)** | Todos |
| `CondicionVenta` | select | REP→`'09'`, otros→`'01'` | `required` | No | Todos |
| `CondicionVentaOtros` | text | `''` | `minLength(5), maxLength(100)` (→ `required` si CondVenta=`99`) | No | Todos menos REP (`*ngIf !REP`) |
| `Currency` | select | `CurrencyATVEnum.CRC` (`'CRC'`) | `required` | No | Todos |
| `ExchangeRate` | text | `'1'` | `required` | Sí cuando Currency=CRC (`UpdateExchangeRate()`) | Todos |
| `PlazoCredito` | number | `0` | `min(0), max(99999)` (→ `required, min(1), max(99999)` si CondVenta `02`/`10`) | No | Todos menos REP |
| `RcprNombre` | text | `''` | `required` (limpiado en ND/NC y REP) | No | Todos |
| `RcprIdeTipo` | select | `'01'` | `required` (ver reglas por docType) | No | Todos |
| `RcprIdeNumero` | text (solo números) | `''` | `required, minLength(9), maxLength(9)` (cambia según tipo ID) | A veces (Ninguna) | Todos |
| `CodigoActividadExterno` | text | `''` | `required, minLength(6), maxLength(6)` (cambia por docType) | No | Todos menos REP |
| `CodigoActividadInterno` | autocomplete | `''` | `required, minLength(6), maxLength(6)` (limpiado en ND/NC/REP) | No | Todos menos REP |
| `EmsrRegistrofiscal8707` | text | `''` | `maxLength(12)` (limpiado en REP) | No | **Solo FEC** (`*ngIf docType=='08'`) |
| `RcprUbProvincia` | select | `''` | depende ubicación (`checkUbicacionFields`) | A veces | No-REP |
| `RcprUbCanton` | select | `''` | depende ubicación | A veces | No-REP |
| `RcprUbDistrito` | select | `''` | depende ubicación | A veces | No-REP |
| `RcprUbBarrio` | autocomplete | `''` | — | A veces | No-REP |
| `RcprUbOtrasSenas` | text | `''` | depende ubicación | A veces | No-REP |
| `RcprCorreoElectronico` | text/email | `''` | `required, minLength(2)` (limpiado en FE/ND/NC/FEC) | No | Todos (lógica especial FEC) |
| `RcprTlfNumTelefono` | number | `''` | `required, min(9999999), max(99999999999999999999)` (limpiado FE/ND/NC/REP) | No | No-REP |
| `RcprCorreoElectronicoCC` | textarea | `''` | — (limpiado en REP) | No | No-REP |
| `RcprOtrasSenasExtranjero` | text | `''` | `required, minLength(5), maxLength(300)` solo cuando ID tipo `05` | **Sí por defecto (disabled)**; se habilita si ID `05` | Todos |
| `Terminal` | hidden | `'0'` | `required` | No (se setea por modal) | Todos |
| `Sucursal` | hidden | `'0'` | `required` | No (se setea por modal) | Todos |
| `MedioPago` | FormArray | `[createMedioPago()]` | `required, totalMontoValidator()` | — | Todos |
| `InfReference` | FormArray | `[createInfReference()]` | — | — | Todos |

> Nota: `RcprCorreoElectronico` se rellena de forma indirecta. El input visible (`emailControls`) NO está atado a `RcprCorreoElectronico` directamente; `updateEmailControl()` concatena los correos válidos con `;` y hace `setValue` en `RcprCorreoElectronico`.

### `createMedioPago()` — grupo del FormArray `MedioPago`

| Campo | Default | Validadores |
|---|---|---|
| `TipoMedioPago` | `'01'` | `required` |
| `MedioPagoOtros` | `''` | `minLength(5), maxLength(100)` (→ `required,...` si TipoMedioPago=`99`) |
| `TotalMedioPago` | `0` | `min(0.01)` |

Máximo **4** medios de pago. `totalMontoValidator()` exige que la suma de `TotalMedioPago` == `this.total` (de lo contrario error `totalMontoMismatch`). Si hay 1 solo medio, `CalculateItemsTotals()` setea su `TotalMedioPago = this.total`.

### `createInfReference()` — grupo del FormArray `InfReference`

| Campo | Default | Validadores iniciales |
|---|---|---|
| `InfReferenceTipoDoc` | `''` | `required` si docType ∈ {FEC, ND, NC, REP}, si no `[]` |
| `InfReferenceTipoDocOTRO` | `''` | `minLength(5), maxLength(100)` (→ `required` si TipoDoc=`99`) |
| `InfReferenceNumero` | `''` | `required` si docType=REP, si no `[]` |
| `InfReferenceCodigo` | `''` | — (depende) |
| `InfReferenceFechaEmision` | `new Date()` | — |
| `InfReferenceCodigoReferenciaOTRO` | `''` | `minLength(5), maxLength(100)` (→ `required` si Código=`99`) |
| `InfReferenceRazon` | `''` | — (depende) |

Máximo **10** nodos. `makeReferenceFieldsRequired/Optional(index)` togglea required en TipoDoc/Numero/Codigo/Razon. Si `InfReferenceTipoDoc === '13'`, Numero y Codigo se vuelven opcionales (facturación mes vencido).

---

## 4. Lista COMPLETA de botones

| Botón | Ubicación | Acción | Habilitado/Deshabilitado |
|---|---|---|---|
| `{{btnAction}}` (Crear/Reenviar) | Toolbar | `OnSubmitCreateDocument()` | `disabled = documentForm.invalid` |
| Terminales y Sucursales | Toolbar | `OpenDialogTermSuc()` | Siempre |
| Colapsar | Toolbar | `accordion.closeAll()` | Siempre |
| Buscar cliente (lupa) | Datos del Cliente | `ShowModal()` | Siempre |
| Clear actividad (x) | Datos Generales | `ClearActiveCode()` | Siempre |
| "Hoy" (por nodo ref) | Datos de Referencia | `SelectCurrentTime('InfReferenceFechaEmision', i)` | Siempre |
| Eliminar referencia (papelera) | Cada nodo ref | `removeInfReference(i)` | `disabled = infReferenceControls.length <= 1` |
| Agregar referencia | Datos de Referencia | `addInfReference()` | `disabled = infReferenceControls.length >= 10` |
| Agregar Ítems / Agregar pago | Datos de Ítems | `AddItem()` | Siempre |
| Actualizar (fila tabla) | tblItems | `OpenDialogAddItems(ELEMENT, ExecutionType.Edit)` | Siempre |
| Eliminar (fila tabla) | tblItems | quita ítem de `itemsList`, recalcula totales | Siempre |
| Eliminar correo (papelera) | Datos de Contacto (FEC) | `removeEmail(index)` | `disabled = mailList.length <= 1` |
| Agregar correo (+) | Datos de Contacto (FEC) | `AddNewEmail()` | `disabled = mailList.length >= 4` |
| Eliminar medio de pago | Datos de Pago | `removeMedioPago(i)` | `disabled = medioPagoControls.length <= 1` |
| Agregar Medio de Pago | Datos de Pago | `addMedioPago()` | `disabled = medioPagoControls.length >= 4` |

---

## 5. Event handlers

| Handler | Disparo | Qué hace |
|---|---|---|
| `OnLoad()` | `NavigationEnd` + ngOnInit | Reset estado, carga listas (DocTypes, IdentificationType, CodigoTarifa, etc.), `LoadInitialData()`, `SetDocTypeString()`. |
| `SetDocTypeString()` | OnLoad | Recrea formulario y aplica reglas por docType (sección 7). |
| `OnConditionSaleChange($event)` | select CondicionVenta | Recalcula lista identificación (FE+`12`), validadores PlazoCredito y CondicionVentaOtros. |
| `OnCurrencyChange($event)` | select Moneda | Reformatea precios de items con nuevo símbolo, `UpdateExchangeRate()`, recarga tabla. |
| `UpdateExchangeRate()` | Currency change | CRC→ExchangeRate='1' y disable; otro→enable. |
| `IdentificationTypeChange(value)` | select Tipo Identif / al elegir cliente | Setea min/max length de `RcprIdeNumero` por tipo, habilita `RcprOtrasSenasExtranjero` si `05`, `UpdateProvinceList()` (FE/FEC). |
| `OnChangePlaces(place, placeId)` | selects Provincia/Cantón/Distrito | Cascada de ubicación (sección 7). |
| `Search($event)` | keydown en Cliente | Si `Tab` → setea filtro y `ShowModal()`. |
| `OnChangeCustomerData(event)` | selección de cliente en modal | Valida tipo de cliente, patch de datos, `IdentificationTypeChange`. |
| `OnReferenceSaleChange($event, i)` | select TipoDoc referencia | Validadores TipoDocOTRO (`99`→req), y campos req/no-req si `13`/`''`. |
| `OnCodeSaleChange($event, i)` | select Código referencia | `CodigoReferenciaOTRO` req si `99`. |
| `onTipoMedioPagoChange(i)` | select Medio de Pago | `MedioPagoOtros` req si `99`. |
| `SelectCurrentTime(control, i)` | botón "Hoy" | setea `new Date()` en fecha de referencia. |
| `updateEmailControl(i, value)` | input/blur email | mantiene `mailList`, concatena válidos con `;` en `RcprCorreoElectronico` (debounce 300ms). |
| `AddNewEmail()` / `removeEmail(i)` | botones email | add/remove control de correo. |
| `addInfReference()` / `removeInfReference(i)` | botones referencia | add/remove nodo; remove pide confirmación modal si TipoDoc tiene valor. |
| `addMedioPago()` / `removeMedioPago(i)` | botones pago | add/remove medio (límites 4/1). |
| `ButtonEvent` | botones tabla items | UPDATE→editar item; DELETE→quita item y ajusta totales. |
| `ClearActiveCode()` | botón x actividad | limpia `CodigoActividadInterno`, resetea filtro. |
| `OnSubmitCreateDocument()` | botón Crear/Reenviar | valida y llama API (sección 8). |

---

## 6. INVENTARIO COMPLETO de llamadas API (LA SECCIÓN CLAVE)

Todas las rutas son relativas (el proxy Rails antepone el host). El header `API` decide a qué backend enruta (`ApiAppUrl` = App server; `ApiFEUrl` = Sync/FE server; `ApiCabysURL` = servicio CABYS externo). Todas llevan `X-Skip-Error-Interceptor: 'true'`.

### Llamadas usadas por Create Document (componente + sub-dialogs)

| Método | Path | Query / Body | Header `API` | Propósito | Servicio |
|---|---|---|---|---|---|
| GET | `api/Documents/GetPharmaceuticalForms` | — | **ApiAppUrl** | Formas farmacéuticas (carga inicial) | `documents.service.GetPharmaceuticalForms` |
| GET | `api/Companies/{companyId}/activity-codes` | path companyId | **ApiAppUrl** | Códigos de actividad de la empresa (autocomplete) | `companies.service.getActivityCodes` |
| GET | `api/Customer` | `companyId`, `docTypeFE`, `filterCustomer` | **ApiAppUrl** | Buscar clientes por empresa/docType (modal) | `customer.service.GetCustomersByCompany` |
| GET | `api/Item` | `companyId`, `docType`, `filter` | **ApiAppUrl** | Buscar productos/items por empresa (add-item) | `product.service.GetProductsByCompany` |
| GET | `api/Numbering/GetTerminalSucursal` | `companyId`, `docType` | **ApiAppUrl** | Terminales y sucursales (term-suc-modal) | `numbering.service.GetTerminalSucursal` |
| GET | `?{codigo\|q}={searchTerm}` (host CABYS) | `codigo` o `q` | **ApiCabysURL** | Búsqueda de códigos CABYS (add-item) | `cabys.service.GetCabys` |
| **POST** | `api/Documents/CreateDocumentManual` | body `DocumentoWithUserId` (ver sección 8) | **ApiFEUrl** ⚠️ | **Crear/emitir documento** | `documents.service.CreateDocument` |

### Datos locales (JSON estáticos, no van por proxy — `assets/data/*.json`)

| Método | Path | Propósito |
|---|---|---|
| GET | `./assets/data/Country.json` | Cantones/distritos/barrios (`GetJSONCountryPlaces`) |
| GET | `./assets/data/Provinces.json` | Provincias (`GetJSONProvinces`) |
| GET | `./assets/data/ImpuestoType.json` | Tipos de impuesto (add-item, `GetJSONImpuestoType`) |
| GET | `./assets/data/UnidadMedidaTypeProducto.json` | Unidades medida producto (add-item) |
| GET | `./assets/data/UnidadMedidaTypeServicio.json` | Unidades medida servicio (add-item) |

> **⚠️ La más importante para la migración**: `POST api/Documents/CreateDocumentManual` usa **`API: ApiFEUrl`** (Sync/FE server). En Rails hay que pasar `headers: { 'API': 'ApiFEUrl' }` o la llamada irá al server equivocado (404). Todas las demás llamadas son `ApiAppUrl` (default). Los JSON de ubicación/impuestos/unidades deben servirse como assets estáticos en Rails.

### Otras APIs del `documents.service.ts` (NO usadas por create-document, pero documentadas porque varias son `ApiFEUrl`)

| Método | Path | Header `API` |
|---|---|---|
| POST | `api/Documents/CreateDocumentManual` | ApiFEUrl |
| POST | `api/Documents/ReceptMessageFromMailParser/` | ApiFEUrl |
| POST | `api/Documents/ReceptMessage` (FormData) | ApiFEUrl |
| PATCH | `api/Documents/{id}/Reprocess?isReceptionDocument=&companyId=` | ApiFEUrl |
| GET/PATCH varios (`api/Documents/...`, `api/Report/...`, `api/Email/...`) | — | ApiAppUrl |

---

## 7. Lógica de negocio por docType

### 7.1 `SetDocTypeString()` — ramas

Comienza siempre: recrea form, `titleAccDatosCliente='Datos del Cliente'`, `labelCodigoActividad='Emisor'`, resetea listas a copias originales y agrega "Ninguna" a `docTypeRefList` y `CodeRefList`.

**FE (`01`)**
- Título "Factura Electrónica".
- `identificationTypeList` = `IdentificationType` SIN "Ninguna" (filtra `Id !== ''`).
- Si `CondicionVenta == '12'` (SaleMerchandiseNonNationalized) → lista = `ForeignNonResidentIdentification` (agrega `05`).
- Teléfono y correo → opcionales (`clearValidators`).
- `RcprIdeTipo` y `RcprIdeNumero` → `required` (Numero `minLength(9), maxLength(9)`).
- `conditionSaleList = CondicionVentaFE` (incluye `12` y `13`).
- Referencias opcionales (`makeReferenceFieldsOptional(0)`), luego `checkReferenceFields()`.

**ND (`02`) y NC (`03`)** (mismo bloque)
- Título según `docType` (ver trampa sección 1).
- `docTypeRefList = TipoDocRefNotesList` (agrega `09` Devolución mercadería).
- `identificationTypeList = ForeignNonResidentIdentification` + "Ninguna" al inicio.
- `IdentificationTypeChange(RcprIdeTipo.value)`.
- Quita "Ninguna" de `docTypeRefList` y `CodeRefList`.
- Teléfono/correo opcionales.
- `DisableIdentificationFields(false)` (obligatorio), luego `checkRcprFields()` y se **limpian** validadores de `RcprIdeTipo`, `RcprIdeNumero`, `RcprNombre`, `CodigoActividadExterno`, `CodigoActividadInterno`.
- Los 5 campos de referencia del nodo 0 (`InfReferenceTipoDoc/Numero/FechaEmision/Codigo/Razon`) → `required`.
- Campos de ubicación → opcionales, `checkUbicacionFields()`, `checkReferenceFields()`.

**FEC (`08`)**
- `titleAccDatosCliente='Datos del Emisor'`, `labelCodigoActividad='Receptor'`, título "Factura Electrónica de Compra".
- `identificationTypeList = IdentificationTypeFEC` (incluye `05` y `06` No Contribuyente). Sin "Ninguna".
- `DisableIdentificationFields(false)`.
- Agrega "Ninguna" a `docTypeRefList` y `CodeRefList`.
- `CodigoActividadExterno` → solo `minLength(6), maxLength(6)` (no required).
- `RcprCorreoElectronico` → clearValidators.
- `checkUbicacionFields()` (ubicación **obligatoria** porque FEC), `checkReferenceFields()`.

**REP (`10`)**
- Título "Recibo Electronico de Pago".
- `conditionSaleList = CondicionVentaREP` (solo `09` y `11`).
- `DisableFieldsREP()`: limpia validadores de `CodigoActividadExterno`, `CodigoActividadInterno`, `EmsrRegistrofiscal8707`, `RcprTlfNumTelefono`, `CondicionVentaOtros`, `PlazoCredito`, `RcprCorreoElectronicoCC`.
- `checkReferenceFields()` (referencias requeridas).
- Default `CondicionVenta='09'`, `InfReferenceTipoDoc` y `InfReferenceNumero` requeridos.

Cierre común: `accordion.closeAll()`, patch `DocType`, reset `itemsList`, `LoadTableData()`.

### 7.2 Reglas de tipo de identificación (`IdentificationTypeChange`)

Setea `ideMinLength`/`ideMaxLength` y validadores de `RcprIdeNumero`:

| Tipo ID | Nombre | min/max | Notas |
|---|---|---|---|
| `01` | Cédula Física | 9 / 9 | |
| `02` | Cédula Jurídica | 10 / 10 | |
| `04` | NITE | 10 / 10 | |
| `03` | DIMEX | 11 / 12 | |
| `05` | Extranjero No Domiciliado | 8 / 20 | Habilita y hace required `RcprOtrasSenasExtranjero` (min5,max300) |
| `06` | No Contribuyente | 8 / 20 | Solo en FEC |

- En **FE/FEC**: seleccionar "Ninguna" (`''`) limpia validadores, setea valor `''` y fuerza error `required` (no permite Ninguna).
- En **otros** docTypes: "Ninguna" deshabilita `RcprIdeNumero`.
- En FEC con ID `05`/`06`: `UpdateProvinceList()` agrega provincia `{Id:'0', Name:'Ninguna'}` y si se elige, `DisabledFieldLocations()` deshabilita y limpia Cantón/Distrito/Barrio/OtrasSenas.

`ValidateCustomerType(customer)`:
- FE + ID `05` → solo válido si `CondicionVenta == '12'`.
- REP + ID `05` → inválido.
- FE/ND/NC/REP + ID `06` (NoContribuyente) → inválido.

### 7.3 Cascada de ubicación (`OnChangePlaces`)

- Provincia → `GetCantonByProvincia(placeId)`, luego distrito `'01'`, barrio `'01'`, `DisabledFieldLocations()`.
- Cantón → `GetDistrictsByCanton(placeId)`, barrio `'01'`.
- Barrio → `GetNeighborhoodByDistricts(placeId)`.
- Listas derivadas de `Country.json` filtrando por IDs encadenados; `neighborhoodId` por defecto `'01'`.
- Barrio es autocomplete filtrado (`_filterNeighborhoods`).
- Ubicación solo aplica a no-REP; obligatoria solo en FEC (`checkUbicacionFields`).

### 7.4 Moneda / tipo de cambio
- `Currency` default CRC. Símbolo: USD `$`, CRC `₡`, EUR `€`.
- CRC → ExchangeRate fijo `'1'` y disabled; otro → editable.

### 7.5 Condiciones de venta
- Listas: `CondicionVenta` (base, sin `12`/`13`), `CondicionVentaFE` (con `12`,`13`), `CondicionVentaREP` (solo `09`,`11`).
- `CondicionVentaOtros` required si CondVenta `99`.
- `PlazoCredito` required (min1) si CondVenta `02` (Crédito) o `10` (IVA 90 días); REP lo limpia.

### 7.6 Referencias (FormArray)
- Para FE/FEC: opcionales hasta que TipoDoc/Codigo/Numero/Razon tenga valor → entonces todos required.
- Para ND/NC/FEC/REP: siempre required (`makeReferenceFieldsRequired(0)`).
- `TipoDoc='13'` (mes vencido) → Numero y Codigo opcionales.
- `removeInfReference`: si TipoDoc tiene valor, abre **modal de confirmación** antes de eliminar.

### 7.7 Cálculo de totales de ítems (`CalculateItemsTotals`)
```
subTotal  += MontoTotal
impuestos += ImpuestoNeto || 0
descuento += MontoDescuento
total     += MontoTotalLinea
```
Si solo hay 1 medio de pago, su `TotalMedioPago = total`.

### 7.8 Medios de pago
- 1..4. Suma de montos debe igualar `total` exacto (`totalMontoValidator`).

---

## 8. Flujos de usuario completos

### 8.1 Crear FE
1. Ruta `/...docType=01`. `OnLoad()`→`SetDocTypeString()` arma form FE.
2. Usuario llena Datos Generales (CondVenta, Moneda, Plazo, Actividad).
3. Busca/elige cliente (lupa→modal). Tipo ID required, número validado por tipo.
4. (Opcional) ubicación, contacto, referencias.
5. Agrega ítems (dialog add-item) → recalcula totales.
6. Configura medios de pago (suma = total).
7. Selecciona Terminal/Sucursal (modal). Si Terminal=0, submit lo abre.
8. Botón Crear → `OnSubmitCreateDocument()`.

### 8.2 Crear FEC (factura-compra)
- Acordeón cliente = "Datos del Emisor"; se capturan datos del **emisor** (proveedor). En el mapeo del backend, los campos `Rcpr*` del form se asignan a campos `Emsr*` del `Documento` (ver `CreateDocument` líneas 800-867). Registro Fiscal 8707 visible. Ubicación obligatoria (salvo ID `05`/`06` con provincia "Ninguna"). Email multi (hasta 4). Referencias requeridas.

### 8.3 Referencias para ND/NC
- Lista de tipos de documento incluye `09` (devolución). Todos los campos de referencia obligatorios. ND/NC limpian validadores de identificación/nombre/actividad (datos del cliente no obligatorios).

### 8.4 REP
- Sin ubicación, teléfono, plazo, actividad ni registro fiscal. Solo `09`/`11` como condición de venta. Sección "Información de pago" en vez de "Datos de Ítems". `InfReferenceTipoDoc` y `InfReferenceNumero` obligatorios. En add-item, `productQuantity=1` forzado (REP).

### 8.5 Buscar cliente
1. `ShowModal()` → `SetColumnRegistrofiscal8707()` (renombra/oculta columna 8707 según FEC).
2. Abre `SearchModalComponent` (linker `modalId`).
3. `OnModalRequestRecords` → `GetCustomersByCompany(companyId, docType, filter)` (ApiAppUrl).
4. Selección → `OnMasterDataSelected` → `OnChangeCustomerData` → patch + `IdentificationTypeChange`.

### 8.6 Agregar/editar/eliminar ítems
- Agregar: `AddItem()`→`OpenDialogAddItems(undefined, Create)`. Editar: botón fila → `OpenDialogAddItems(ELEMENT, Edit)`. Eliminar: botón fila → splice + ajuste totales.
- El dialog devuelve `{ItemList, ItemId, Price, ExecutionType, Totales, CabysSearch}`; `LoadItems()` agrega/actualiza y formatea NewCode/ProductPrice/Total para tabla.

### 8.7 Submit + manejo respuesta Hacienda (`OnSubmitCreateDocument`)
Validaciones previas:
- Si NO es FEC o el código de referencia ≠ `CodigoRefList[0].Id` (`'01'`): busca ítems con `PrecioUnitario === 0` y sin código de impuesto válido (`!ImpCodigo || '' || '00'`). Si hay → Toast INFO y aborta.
- `markAllAsTouched()`; requiere `documentForm.valid && itemsList.length>0 && Terminal != 0`.

Llama `CreateDocument(documentForm, itemsList, docId)` → `POST api/Documents/CreateDocumentManual` (**ApiFEUrl**).

Respuesta `CreateDocResponse`:
- `data.result == true` y `HaciendaInfo != null` → **Modal SUCCESS** "Documento creado correctamente", subtitle `Estado: {Estado} | Clave: {Clave}`. Reset (`docId=0`, btn "Crear", `OnLoad()`).
- `data.result == true` y `HaciendaInfo == null` → **Modal WARNING** "Documento creado con errores", subtitle `errorInfo.Message`. `docId = data.DocId`, btn pasa a **"Reenviar"**.
- `data.result == false` → Toast ERROR `errorInfo.Message`.
- error HTTP → Toast ERROR `GetError(err)`.

Si form inválido / sin ítems / sin Terminal-Sucursal → Toast con mensaje compuesto; si falta Terminal/Sucursal abre el modal.

**Cuerpo del POST** (`DocumentoWithUserId`): `{ documento: Documento, UserId }`. `Documento` incluye totales calculados en el servicio (TotalServGravados, TotalMercanciasGravadas, TotalExonerado, TotalImpuesto, TotalComprobante, etc.), datos emisor/receptor mapeados según FEC vs otros, `V_LineaDetalle` (items sin NewCode/ProductPrice/Total), `V_MedioPago`, `V_InfReferencia` (mapeado a `IInfReferencia`). REP usa `totalVentaREP` y `TotalComprobante = TotalVenta + TotalImpuesto`.

---

## 9. Sub-dialogs

### 9.1 `add-item` (`AddItemComponent`)

**Data de entrada** (`MAT_DIALOG_DATA`): `{ dataItemModel, ItemList, ItemId, CabysSearch, executionType (Create=2/Edit=1), DocType, InfRefCodigo, PharmaceuticalForms }`.

**Forms**: `cabysForm`, `cabysSurtidoForm`, `productForm`, `surtidosForm`.

**`productForm` (CreateProductForm) — campos clave:**

| Campo | Default | Validadores |
|---|---|---|
| `codigo` (CABYS) | `''` | required |
| `CodTipo` (código item) | `''` | required |
| `productDescription` | `''` | required |
| `productDiscount` | `'0'` | required, min0, max100 |
| `productPrice` | `''` | required, min0 |
| `productTax` | `''` | required |
| `productTaxOTRO` | `''` | (req si tax=`99`) |
| `productTaxRate` | `'0'` disabled | required, GreaterThanZero, max100 |
| `productQuantity` | `''` | required |
| `unitMeasurement` | `''` | required |
| `commercialMeasureUnit` | `''` | — |
| `productType` | `''` | required (`01` producto / `02` servicio) |
| `CodigoTarifa` | `''` disabled | (req si tax=VAT) |
| `PartidaArancelaria` | `''` | minLength12, maxLength12 |
| `RegistroMedicamento` | `null` | maxLength100 |
| `FormaFarmaceutica` / `FormaFarmaceuticaDesc` | `null` | autocomplete |
| `BaseImponible` | `''` | (req si VATSpecial/IVAFabrica) |
| Exoneración: `ETipoDocumento` (`'00'`), `ETipoDocumentoOTRO`(max100), `EFechaEmision`(hoy), `ENumeroDocumento`, `ENombreInstitucion`, `ENombreInstitucionOtros`(max100), `ETarifaExonerada`, `EMontoExoneracion`(disabled), `ImpuestoNeto`(disabled,0), `EArticulo`(max999999), `EInciso` | — | condicionales por `DocumentTypeChange` |
| `regalia` | `false` | — |
| `TipoTransaccion` | `'01'` | — |
| `IVACobradoFabrica`, `NumeroVINoSerie`, `DCodigoDescuento`, `DCodigoDescuentoOTRO`, `ImpuestoAsumidoEmisorFabrica`(disabled), `ImpCantidadUnidadMedida`, `ImpVolumenUnidadConsumo`, `BebidaJabon` | — | condicionales |

**Lógica de impuestos** (`ConfigureFormByTaxCode`): por cada `TaxTypeCode` configura tarifa/código de tarifa y validadores:
- `''` None → tarifa 0, deshabilita CodigoTarifa.
- `01` VAT → tarifa default 13 / código `08`, CodigoTarifa required.
- `02` Selectivo, `99` Otros → tarifa editable.
- `04` Alcohol, `05` Bebida/Jabón, `06` Tabaco, `03` Combustible → cantidad/volumen unidad required, ClearTaxRate.
- `07` VAT especial → BaseImponible required.
- `08` VAT usado, `12` Cemento (tarifa 5 si no surtido) → reglas propias.

**Cálculo de impuesto** (`calculateTax`): según `TaxTypeCode`, descuento por regalía/bonificación (`01`/`03` con IVA), surtidos suman `ImpMontoSurtido * quantity`.

**`AddItem()`** (guardar): calcula `MontoTotal`, `MontoDescuento`, `SubTotal`, `ImpMonto`, `EMontoExoneracion`, `ImpuestoNeto`, `MontoTotalLinea = SubTotal + ImpuestoNeto`. Si **regalía**: `MontoTotal=0`, `SubTotal=0`, `MontoTotalLinea = ImpMonto` (o `ImpuestoNeto` si exonerado). Construye `ILineaDetalle` y lo agrega/edita. `CloseModal(itemsList, executionType)` retorna `{ItemList, ItemId, Price, ExecutionType, Totales, CabysSearch}`.

**Regalía** (`ItsRoyalty`): requiere precio digitado antes; pone precio 0 y deshabilita.

**Surtidos** (`surtidosForm`, hasta 20): subforma para detalle surtido con sus propios CABYS, impuesto, cantidad, precio. Calcula precio/descuento/impuesto agregados que sobreescriben los del producto principal.

**APIs llamadas**: `GetProductsByCompany` (ApiAppUrl), `GetCabys` (ApiCabysURL), `GetJSONImpuestoType/UnidadMedida*` (assets locales).

**Outputs (al cerrar)**: objeto con la lista de líneas y totales; o `{ExecutionType:0}` si se cancela (Escape cierra con result vacío).

### 9.2 `term-suc-modal` (`TermSucModalComponent`)

**Data**: `{ SelectedCompany, DocType }`.
- `CreateTermSucForm()`: control `TermSuc` (default `''`).
- `LoadInitialData()` → `GetTerminalSucursal(companyId, docType)` (ApiAppUrl). Si hay datos, selecciona el primero; si no, modal WARNING y navega a `/numbering`.
- Vista: select "Terminal: {Terminal} - Sucursal: {SucursalNum}".
- Botones: **Cancelar** (`CloseModal(true)` → cierra con `true`, padre ignora) y **Guardar** (`CloseModal('')` → cierra con array filtrado).
- **Output**: `IViewNumbering[]` (el padre toma `result[0].SucursalNum` y `result[0].Terminal`). `Escape` cierra con result default.

---

## 10. Edge cases y validaciones

- **Precio cero sin impuesto**: en submit, ítems con `PrecioUnitario === 0` y `ImpCodigo` vacío/`'00'` bloquean el envío (salvo FEC con código de referencia `'01'`). Toast INFO con los detalles de los ítems.
- **Terminal/Sucursal = 0**: bloquea submit y abre el modal automáticamente.
- **`showErrorMessage()`**: arma lista de mensajes de error para tooltip del botón Crear (Nombre, Identificación min/max, Código actividad min/max 6, Otras Señas Extranjero min5/max300, Provincia/Dirección, Correo/Teléfono, y campos de referencia TipoDoc/Numero/Codigo/Razon).
- **`showSucuAndTerErrorMessage()`**: tooltip del botón Terminales si Terminal/Sucursal = 0.
- **Validación de cliente** (`ValidateCustomerType`): bloquea combinaciones inválidas docType+tipoID (sección 7.2).
- **Email**: regex propia (`CustomEmailValidator`/`IsValidEmail`); concatena válidos con `;`. FEC permite hasta 4 correos.
- **`totalMontoValidator`**: suma de medios de pago debe ser exactamente igual a `total`.
- **GreaterThanZero** (add-item): `productTaxRate` debe ser > 0 (salvo null/vacío).
- **Surtidos**: máx 20; eliminar el surtido en edición pide confirmación.
- **Regalía**: exige precio previo, fuerza tax exento; en envío `PrecioUnitario` se pone 0 (`CreateDocument`).

---

## 11. Matriz de funcionalidad (Rails)

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Pantalla create-document (controller + view + layout 'protected') | No | 0% | Pendiente |
| Routing por docType (01/02/03/08/10) | No | 0% | Recibir docType por ruta/param |
| Acordeón de 7 secciones | No | 0% | Datos Generales, Cliente/Emisor, Ubicación, Contacto, Referencia, Ítems/Pago, Datos de Pago |
| Form `documentForm` con todos los controles | No | 0% | Ver sección 3 |
| FormArray `MedioPago` (1-4) | No | 0% | Validador suma == total |
| FormArray `InfReference` (1-10) | No | 0% | Reglas por docType |
| Ramificación `SetDocTypeString` por docType | No | 0% | Replicar trampa ND/NC títulos |
| Reglas tipo identificación (min/max) | No | 0% | 01..06 |
| `ValidateCustomerType` | No | 0% | Combinaciones bloqueadas |
| Cascada ubicación (Provincia→Cantón→Distrito→Barrio) | No | 0% | Desde Country.json |
| Moneda + tipo de cambio | No | 0% | CRC fija 1 |
| Condiciones de venta por docType | No | 0% | 3 listas |
| Multi-email FEC (1-4) | No | 0% | Concatenar con `;` |
| Modal búsqueda cliente | No | 0% | GET api/Customer |
| Modal Terminal/Sucursal | No | 0% | GET GetTerminalSucursal |
| Dialog add-item (productForm + surtidos + CABYS) | No | 0% | Panel lateral (no modal) |
| Cálculo de impuestos por TaxTypeCode | No | 0% | ConfigureFormByTaxCode + calculateTax |
| Cálculo línea (MontoTotalLinea, regalía, exoneración) | No | 0% | Sección 9.1 |
| Cálculo totales documento (Gravado/Exento/Exonerado/...) | No | 0% | En CreateDocument service |
| Búsqueda CABYS | No | 0% | ApiCabysURL |
| Submit + POST CreateDocumentManual | No | 0% | **ApiFEUrl** |
| Manejo respuesta Hacienda (success/warning/reenviar) | No | 0% | Modal + estado botón |
| Validación precio cero / sin impuesto | No | 0% | Toast INFO |
| Validación Terminal/Sucursal = 0 | No | 0% | Abre modal |
| Tabla de ítems (editar/eliminar) | No | 0% | Tabulator |
| Tabla de totales pie de página | No | 0% | SubTotal/Impuestos/Descuento/Total |
| Formas farmacéuticas / actividad económica | No | 0% | GET endpoints ApiAppUrl |
| Datos JSON locales (Country/Provinces/Impuesto/Unidades) | No | 0% | Servir como assets en Rails |

---

### Notas finales de migración
- **Enrutamiento de proxy**: solo `CreateDocumentManual`, `ReceptMessage*` y `Reprocess` usan `ApiFEUrl`. El resto (clientes, items, numeración, formas farmacéuticas, códigos de actividad) usa `ApiAppUrl` (default). Los JSON de catálogos son assets estáticos.
- **Siempre** enviar `Cl-Company-Id` en Rails (el legacy lo resuelve por `SelectedCompany.companyId` en cada query).
- Replicar **exactamente** la inversión de títulos ND/NC (no corregir).
- Por convención del proyecto (CLAUDE.md): formularios complejos y add-item → **panel lateral**, no modal. Confirmaciones destructivas (eliminar referencia/surtido) → modal.
