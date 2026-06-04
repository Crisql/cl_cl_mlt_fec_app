# COMPANIES — Análisis Completo de Migración

**Módulo Angular:** `pages/configuration/company/`
**URL Rails objetivo:** `http://localhost:3000/configurations/companies`

---

## Estructura de la página

El módulo tiene **dos vistas**:

1. **Index** (`company.component`) — Búsqueda y listado de compañías
2. **Create/Edit** (`create-or-update-company.component`) — Formulario en acordeón

---

## VISTA 1: Index (company.component)

### Campos del formulario de búsqueda

| Campo | Tipo | Validaciones |
|---|---|---|
| LegalName | text | ninguna |
| ComercialName | text | ninguna |
| Identification | number | ninguna |

### Botones del encabezado

| Botón | Acción | Habilitado |
|---|---|---|
| Consultar | `GetCompanies(true)` → reset página a 0 | siempre |
| Crear | navega a `create` | solo si permiso `F_CreateCompany` |

### Tabla

Columnas visibles:
- **Nombre Legal** (EmsrNombre)
- **Nombre Comercial** (EmsrNombreComercial)
- **Identificación** (EmsrIdeNumero)
- **Compañía Favorita** — ícono `star` amarillo si Favorite=true, vacío si false
- **Activa** — badge activo/inactivo según campo `Active`

Columnas ignoradas: todas las demás (50+ campos)

Paginación: server-side, opciones 5/10/15, default 5

### Botones por fila

| Ícono | Título | Permiso | Acción |
|---|---|---|---|
| `star` | Establecer como Favorita | ninguno | Si `QtyRolAssign === 0` → toast INFO "no posee asignaciones"; si > 0 → modal confirmación → `SetFavoriteCompany(id)` |
| `edit` | Actualizar | `F_ModifyCompany` | Si no tiene permiso → toast INFO; si tiene → navega a `{id}/edit` |

### API calls

| Método | Endpoint | Params |
|---|---|---|
| GET | `api/Companies/GetCompanies` | `LegalName`, `ComercialName`, `Identification`, `StartPos` (page+1), `StepPos` (itemsPerPage), `RequirePagination=true`, `status=''` |
| POST | `api/companies/{id}/favorite` | body: null |

### Lógica de paginación

- `currentPage` empieza en 0, se envía como `StartPos = currentPage + 1`
- `RecordsCount = companiesListPaginator[0]?.MaxQtyRowsFetch || 0`
- `itemsPeerPage` default 5

---

## VISTA 2: Create/Edit (create-or-update-company.component)

### Constantes

**IdentificationType:**
| Id | Nombre | Min | Max |
|---|---|---|---|
| '01' | Cédula Fisica | 9 | 9 |
| '02' | Cedula Juridica | 10 | 10 |
| '03' | DIMEX | 11 | 12 |
| '04' | NITE | 10 | 10 |

**NameToEmailType:**
| Id | Value |
|---|---|
| 1 | Nombre Legal |
| 2 | Nombre Comercial |

**FreightChargesType:**
| Id | Value |
|---|---|
| 1 | Articulos |
| 2 | Otros Cargos |

---

### Sección 1: Datos Generales de la Compañía

**Formulario:** `companyForm`

| Campo | Tipo | Default | Validaciones |
|---|---|---|---|
| ComercialName | text | '' | required |
| LegalName | text | '' | required |
| Type | select (IdentificationType) | '01' | required |
| Identification | number | '' | required, minLength/maxLength por Type |
| CodigoActividad | text | '' | required, min 6, max 6 |
| NameToEmail | select (NameToEmailType) | 1 | required |
| GroupId | select (grupos API) | 1 | required |
| ShortName | text | '' | required |
| FreightCharges | select (FreightChargesType) | 1 | required |
| Registrofiscal8707 | text | '' | maxLength 12 |
| SAPConnectionId | select (conexiones API) | null | required |
| DBSap | text | '' | required |
| IsExternal | checkbox | false | — |
| Active | checkbox | true | — |

**Notas:**
- Al cambiar `Type` → `IdentificationTypeChange()` ajusta min/max de Identification
- Botón "Agregar conexión" (ícono `add`) en el select de SAPConnectionId — solo si `permCreateConnection = F_Configurations_Connections_Create`. Abre dialog de crear conexión. Al cerrar con `created=true`, recarga lista y selecciona la última.
- Botón "Actualizar datos generales" — solo en modo edición, deshabilitado si form inválido → action=1 en `EditCompany`

**API para cargar:**
- GET `api/Group/GetGroups`
- GET `api/SapConnections/GetConnectionsForAssignment` (SapConnectionsService)

---

### Sección 2: Adicional

**Formulario:** `additionalInformationForm`

| Campo | Tipo | Default | Validaciones |
|---|---|---|---|
| AdditionalInformation | textarea | '' | ninguna |
| EmailCC | FormArray de inputs | [''] | pattern email `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$` |

**Lógica EmailCC:**
- Array dinámico. Botón `+` (add) solo en el último elemento → `AddEmail()`
- Botón `-` (remove) en cada elemento → `RemoveEmailCC(i)`. Si es el único → modal INFO "No se puede eliminar el último registro"
- Al cargar en edición: split de `companyData.EmailCC` por `;`
- Al guardar: join de valores con `;`

**Botón:** "Actualizar datos adicionales" — solo edición → action=5

---

### Sección 3: Datos de Conexión de Hacienda (ATV)

**Formulario:** `atvForm`

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| CertPin | password (toggle) | '' | onClick → guarda valor actual; onBlur/Enter → `ChangeCertPin()` |
| CertPath | text readonly | '' | file picker (.p12/.pfx), botón download |
| CertExpireDate | text readonly | '' | auto-calculado tras seleccionar cert + pin |
| TokenUsr | text | '' | — |
| TokenPass | password (toggle) | '' | — |

**Lógica CertPin/CertPath:**
- `OnFileSelected`: valida extensión .p12/.pfx. Si no tiene pin → warning modal. Si tiene → `GetCertExpireDate()`
- `ChangeCertPin(certPin)`: si cambió y hay archivo → `GetCertExpireDate()`
- `GetCertExpireDate()` → POST `api/Companies/CheckCertExpireDate?CertPin={pin}` (FormData con file)

**Validaciones al guardar (ATV o Create):**
- Si `CertPath` no está vacío → debe incluir el `Identification`
- Si `TokenUsr` numérico → debe incluir el `Identification`

**Botón download certificado:** GET `api/companies/{id}/certificate` (blob)

**Botón:** "Actualizar datos de Hacienda" — solo edición → action=2

---

### Sección 4: Adjuntos de la compañía

**Formulario:** `attForm`

| Campo | Tipo | Acepta |
|---|---|---|
| logo | file input | jpg, jpeg, png |
| FEPrintFormat | file input | .rpt |

**Lógica:**
- Logo: `OnLogoSelected()` valida extensión jpg/jpeg/png
- FEPrintFormat: `OnFEPrintFormatSelected()` valida .rpt
- Botón download logo: GET `api/companies/{id}/logo` (blob)
- Botón download FEPrintFormat: GET `api/companies/{id}/print-format` (blob)
- Botón restablecer formato (si `permupdate = F_ResetCompanyFormat`): modal confirmación → PATCH `api/Companies/ResetCompanyPrintFormat?companyId={id}`

**Botón:** "Actualizar adjuntos" — solo edición → action=3

---

### Sección 5: Códigos de actividad (solo edición)

**Formulario:** `activityCodesForm` con `FormArray ActivityCodes`

Cada ítem:
| Campo | Tipo | Validaciones |
|---|---|---|
| Code | text | required, min 6, max 6 |
| Name | text | required |

**Lógica:**
- Botón `+` agrega nuevo grupo → `addActivityCode()`
- Botón delete por ítem → `removeActivityCode(i)`
- Validador de array: no puede haber dos `Code` iguales (`duplicateActivityCode`)
- Botón "Actualizar códigos de actividad" → PUT `api/Companies/{id}/activity-codes`

**Carga:** GET `api/Companies/{id}/activity-codes`

---

### Sección 6: Datos para Factura a Proveedor

**Formularios:** `companyForm` (UseFactProv, SendReceptAndApInv) + `sapForm` (resto)

`sapForm` inicia **deshabilitado** y se habilita solo si `UseFactProv = true`.

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| UseFactProv | checkbox | false | onChange → `ChangeUseFactProv()` |
| SendReceptAndApInv | checkbox | false | visible solo si `UseFactProv = true` |
| NumSerieProv | number | null | required si UseFactProv |
| NumSerieFactProv | number | null | — |
| DefaultTaxForXML | select (API) | '' | required si UseFactProv y editando |
| whDefault | select (API) | '' | required si UseFactProv y editando |
| XmlToleranceAmounts | FormArray | [] | CurrencyCode (select) + Tolerance (number); sin duplicados por CurrencyCode |
| XmlCurrencyMappings | FormArray | [] | XmlCurrencyCode (text) + MappedCurrencyCode (select); sin duplicados por XmlCurrencyCode |

**API para datos SAP:**
- GET `api/Tax?companyId={id}` → taxCodeList
- GET warehouse list → warehouseSAPList (DocumentsService)
- GET `api/Companies/{id}/currencies` → currenciesList

**Botón "Recargar información":** recarga warehouse, taxes, currencies. Deshabilitado si no hay `SAPConnectionId`

**Botón "Actualizar datos SAP":** solo edición. Llama action=4 + SaveCurrencyMappings → PUT `api/Companies/{id}/currency-map`

**Deshabilitado si:** `!UseFactProv || sapForm.invalid || XmlToleranceAmounts.length === 0`

---

### Flujo de Creación (modo create)

1. Carga inicial: `LoadInitialData()` → forkJoin(GetGroups, GetSAPConnections)
2. Formularios sin datos previos
3. `sapForm` deshabilitado hasta UseFactProv=true
4. Botón "Registrar Datos de la Compañía" al fondo, visible solo en modo create
5. Validaciones: `companyForm.valid`, cert+token vs identification, sapForm si UseFactProv
6. POST `api/Companies?companyId={selectedCompanyId}&groupId={groupId}&feToken={token}` (FormData)
7. Éxito → navega a `/configurations/companies`

### Flujo de Edición

1. Detecta `idCompany` en ruta
2. `LoadCompanyInformation()` → forkJoin(8 llamadas en paralelo)
3. `FillForms()` → llena todos los formularios
4. Cada sección tiene su propio botón guardar
5. Botón "Registrar" NO aparece

---

## API Endpoints Completos

| Método | Endpoint | Uso |
|---|---|---|
| GET | `api/Companies/GetCompanies` | Index con paginación |
| POST | `api/companies/{id}/favorite` | Establecer favorita |
| GET | `api/Group/GetGroups` | Lista grupos |
| GET | `api/SapConnections/GetConnectionsForAssignment` | Lista conexiones SAP |
| GET | `api/companies/{id}` | Detalle compañía |
| POST | `api/Companies` | Crear compañía (FormData multipart) |
| PATCH | `api/Companies` | Editar compañía (FormData multipart, param action) |
| GET | `api/Tax?companyId={id}` | Códigos de impuesto SAP |
| GET | `api/warehouse?companyId={id}` | Almacenes SAP |
| GET | `api/Companies/{id}/currencies` | Monedas |
| GET | `api/Companies/{id}/currency-map` | Mapeo monedas |
| PUT | `api/Companies/{id}/currency-map` | Guardar mapeo monedas |
| GET | `api/Companies/{id}/activity-codes` | Códigos actividad |
| PUT | `api/Companies/{id}/activity-codes` | Guardar códigos actividad |
| GET | `api/companies/{id}/print-format` | Descargar formato impresión (blob) |
| GET | `api/companies/{id}/certificate` | Descargar certificado (blob) |
| GET | `api/companies/{id}/logo` | Descargar logo (blob) |
| POST | `api/Companies/CheckCertExpireDate?CertPin={pin}` | Obtener fecha expiración cert |
| PATCH | `api/Companies/ResetCompanyPrintFormat?companyId={id}` | Restablecer formato |

---

## Permisos

| Permiso | Efecto |
|---|---|
| `F_CreateCompany` | Muestra botón "Crear" en index |
| `F_ModifyCompany` | Permite clic en botón editar de fila |
| `F_ResetCompanyFormat` | Muestra botón restablecer formato |
| `Configurations_Connections_Create` | Muestra botón agregar conexión SAP |

Todos obtenidos de `storageService.GetUserPermissions()` → array de `{ Name: string }`

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Index: búsqueda + tabla paginada | ❌ | 0% | |
| Index: favorita | ❌ | 0% | |
| Index: editar (navegar) | ❌ | 0% | |
| Index: crear (navegar) | ❌ | 0% | |
| Create: formulario completo | ❌ | 0% | |
| Edit: cargar datos | ❌ | 0% | |
| Edit: guardar por sección | ❌ | 0% | |
| Cert/token validation | ❌ | 0% | |
| Códigos actividad | ❌ | 0% | |
| Factura proveedor | ❌ | 0% | |
| Descargas (cert, logo, format) | ❌ | 0% | |
