# Convenciones de UI — FEC Rails Migration

## 17. Paginación remota Tabulator — contador de filas correcto

**Problema:** `paginationCounter: 'rows'` calcula el total como `last_page × pageSize`.
Si la última página no está llena (ej. 154 registros en páginas de 10 → last_page = 16),
Tabulator muestra "160 filas" en la primera carga y corrige a 154 solo al llegar a la última página.

**Causa raíz:** Tabulator no conoce el total real — solo infiere `last_page` del API response.

**Patrón obligatorio para toda tabla con paginación remota:**

```js
// 1. Campo de instancia para guardar el total real
#totalRecords = 0;

// 2. En getTableConfig() — reemplazar paginationCounter: 'rows'
paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
  const total = this.#totalRecords;
  if (!total) return '';
  const to = Math.min(currentRow + _pageSize - 1, total);
  return `Mostrando ${currentRow.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
},

// 3. En #fetchPage() — guardar el total antes de retornar
const total = json.Data[0]?.MaxQtyRowsFetch ?? 0;  // o la propiedad que use la API
this.#totalRecords = total;
const lastPage = Math.max(1, Math.ceil(total / size));
return { data: json.Data, last_page: lastPage };
```

**⚠️ NUNCA usar `paginationCounter: 'rows'`** en tablas con `paginationMode: 'remote'`.

### Paginación remota — migrar de `setData()` local a `ajaxRequestFunc`

Si un controller carga datos con `this.table.setData(records)` (modo local), Tabulator
no puede paginar correctamente en el servidor. El patrón correcto es `ajaxRequestFunc`:

```js
// getTableConfig()
ajaxURL: '/api/MiEndpoint',                              // activa modo remote
ajaxRequestFunc: (_url, _config, params) => this.#fetchPage(params),
ajaxResponse:    (_url, _params, response) => response,

// connect() — super.connect() ya dispara la primera carga, no llamar #fetchPage manualmente
super.connect();

// action público de búsqueda — setData() recarga y vuelve a página 1
search() { this.table?.setData(); }
```

## 0. Registro obligatorio de Stimulus controllers

**Regla:** Todo controller nuevo **DEBE** registrarse en `app/javascript/controllers/index.js`
como parte del mismo paso en que se crea el archivo `*_controller.js`.
Si no se registra, Stimulus no reconoce el `data-controller` y la página queda muda (sin errores visibles).

### Patrón obligatorio

```js
// 1. Import al final del bloque de imports
import BranchesController from 'controllers/branches_controller'

// 2. Register al final del bloque de application.register(...)
application.register('branches', BranchesController)
```

### Regla del nombre del identificador

El identificador de `application.register` debe coincidir exactamente con el valor de
`data-controller="..."` en la vista ERB.
Convención: `snake_case` del archivo → `kebab-case` del identificador.

| Archivo | Identificador |
|---|---|
| `branches_controller.js` | `branches` |
| `roles_by_users_controller.js` | `roles-by-users` |
| `company_form_controller.js` | `company-form` |

### ⚠️ Error silencioso más frecuente en migraciones

**Síntoma:** La página carga pero no hace ninguna llamada API, la tabla aparece vacía
y no hay errores en consola.
**Causa:** El controller no está registrado en `index.js`.
**Verificación:** `grep 'NombreController' app/javascript/controllers/index.js`

---

## 1. Badges de estado

Todos los estados (activo/inactivo, estados de documentos, etc.) se renderizan como
**badges tipo Jira**: fondo tenue + texto en color + `rounded-full`.

### Colores base

| Estado | Fondo | Texto | Uso |
|---|---|---|---|
| Activo | `#e8f5ee` | `#3a7d52` | Registros habilitados |
| Inactivo | `#fdecea` | `#c0392b` | Registros deshabilitados |
| Abierto / Open | `#e8f0fe` | `#1a56db` | Documentos abiertos |
| Cerrado / Closed | `#f3f4f6` | `#4b5563` | Documentos cerrados |
| Pendiente | `#fffbeb` | `#b45309` | En espera de acción |
| Cancelado | `#fef2f2` | `#991b1b` | Anulados |
| Borrador / Draft | `#f5f3ff` | `#6d28d9` | Sin confirmar |
| Pagado | `#ecfdf5` | `#065f46` | Documentos pagados |
| Parcial | `#fff7ed` | `#c2410c` | Pago parcial |

### Implementación (JavaScript)

```js
#statusBadge(status) {
  const map = {
    active:    { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'    },
    inactive:  { bg: '#fdecea', color: '#c0392b', label: 'Inactivo'  },
    open:      { bg: '#e8f0fe', color: '#1a56db', label: 'Abierto'   },
    closed:    { bg: '#f3f4f6', color: '#4b5563', label: 'Cerrado'   },
    pending:   { bg: '#fffbeb', color: '#b45309', label: 'Pendiente' },
    cancelled: { bg: '#fef2f2', color: '#991b1b', label: 'Cancelado' },
    draft:     { bg: '#f5f3ff', color: '#6d28d9', label: 'Borrador'  },
    paid:      { bg: '#ecfdf5', color: '#065f46', label: 'Pagado'    },
    partial:   { bg: '#fff7ed', color: '#c2410c', label: 'Parcial'   },
  }
  const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status }
  return `<span style="background-color:${bg}; color:${color};"
               class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
    ${label}
  </span>`
}
```

### Implementación (ERB inline)

```erb
<span style="background-color:#e8f5ee; color:#3a7d52;"
      class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
  Activo
</span>
```

---

## 2. Botones de acción en tablas

Los botones de acción en filas de tabla usan **ícono + tooltip**, sin texto visible.
El tooltip se muestra via JS con `position: fixed` (no CSS puro) para evitar ser recortado
por el `overflow: hidden` que Tabulator aplica en las celdas.

### Estructura HTML (dentro de formatters Tabulator)

```html
<button type="button"
        data-action-type="edit"
        data-tooltip="Editar"
        class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
  <span class="material-icons text-base">edit</span>
</button>
```

### Cómo funciona

`TabulatorController.setupTooltip()` (llamado automáticamente en `initializeTable()`) registra
event delegation sobre el contenedor de la tabla. Al hacer hover en cualquier `[data-tooltip]`,
mueve un `div#cl-tabulator-tooltip` con `position: fixed; z-index: 9999` a las coordenadas
del cursor — nunca queda dentro del stacking context de la celda.

### Reglas

- Agregar `data-tooltip="Texto"` directamente en el `<button>` — **no** en el span de ícono
- **No usar** `<div class="relative group">` + `<span class="...group-hover:opacity-100...">` en tablas Tabulator — el `overflow:hidden` de las celdas recorta esos tooltips
- Para tooltips **fuera de Tabulator** (formularios, toolbar) sí se puede usar el patrón CSS puro con `group-hover`

### Tooltips en botones deshabilitados — mensaje específico obligatorio

Los botones que se inhabilitan en función del estado de la fila **deben incluir `data-tooltip` con una razón específica y accionable**. Nunca usar mensajes genéricos.

| ❌ Incorrecto | ✅ Correcto |
|---|---|
| `"Esta opción no está disponible"` | `"El correo debe tener detalle para ver esta opción"` |
| `"No disponible"` | `"El documento debe estar en estado Abierto para anularlo"` |
| `"Acción no permitida"` | `"Solo se puede reenviar si el estado del correo es Error"` |

**Regla:** el tooltip del botón deshabilitado debe responder implícitamente a la pregunta *¿cuándo SÍ podré usarlo?*

```js
// ✅ CORRECTO — tooltip explica la condición
const tooltip = hasDetail
  ? 'Ver detalle del correo'
  : 'El correo debe tener detalle para usar esta opción';

return `<button type="button"
                data-action-type="view-detail"
                data-tooltip="${tooltip}"
                ${hasDetail ? '' : 'disabled'}
                class="...">
  <span class="material-icons text-base">lists</span>
</button>`;

// ❌ INCORRECTO — tooltip genérico o ausente en botón deshabilitado
return `<button type="button"
                data-action-type="view-detail"
                ${hasDetail ? 'data-tooltip="Ver detalle"' : ''}
                ${hasDetail ? '' : 'disabled'}
                class="...">
  <span class="material-icons text-base">lists</span>
</button>`;
```

**Importante:** `data-tooltip` debe estar **siempre** presente en el botón, habilitado o no.
El tooltip del estado habilitado describe la acción; el del deshabilitado explica la condición.

---

## 3. Columnas de tabla estándar

| Tipo de columna | Renderizado |
|---|---|
| Estado | Badge (ver sección 1) |
| Acciones | Botón ícono + tooltip (ver sección 2) |
| Fecha | Formato `DD/MM/YYYY` |
| Monto | `toLocaleString('es-CR')` + símbolo de moneda |
| Booleano | Badge Activo/Inactivo |

---

## 4. Inputs con botones sufijo (matSuffix)

Todo campo que tenga botones de acción dentro del input (adjuntar archivo, descargar,
toggle password, agregar ítem) usa un **contenedor unificado con borde compartido**,
equivalente al `mat-form-field` con `matSuffix` de Angular Material.

### Estructura HTML

```html
<div class="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50">
  <input type="text" readonly
         class="flex-1 px-3 py-2 text-sm bg-transparent outline-none cursor-default">
  <button type="button"
          class="self-stretch flex items-center px-2 border-l border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
          title="Acción">
    <span class="material-icons text-base leading-none">attach_file</span>
  </button>
</div>
```

### Reglas

- El **wrapper** lleva el borde, radio y `overflow-hidden`. El input/select no tiene borde propio.
- `focus-within:ring-2 focus-within:ring-blue-500` en el wrapper → todo el contenedor se resalta al hacer focus.
- Cada botón sufijo lleva `border-l border-gray-200` para el separador vertical interno.
- `flex-shrink-0` en botones para que no se compriman.
- `leading-none` en el ícono para evitar altura extra.
- El input usa `bg-transparent outline-none` para no mostrar borde ni fondo propios.
- Para inputs **editables**: `bg-white` en el wrapper. Para **readonly**: `bg-gray-50` + `cursor-default`.
- **NO usar `p-2` en botones sufijo** — usar `self-stretch flex items-center px-2`.

### Toggle de contraseña (posición absoluta)

```html
<div class="relative">
  <input type="password"
         class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500">
  <button type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
    <span class="material-icons text-base">visibility_off</span>
  </button>
</div>
```

---

## 5. Formato de fechas

Todas las fechas se muestran en formato **`yyyy-MM-dd HH:mm:ss`** (ISO 8601 con espacio).

```js
#formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

- **NO usar** `toLocaleDateString()` ni `toLocaleString()` para fechas de la API.
- Solo usar `toLocaleString('es-CR')` para **montos**.

---

## 6. Manejo de errores de API — header `cl-message`

El backend envía mensajes de error en el header HTTP `cl-message` (URI-encoded).
El proxy Rails reenvía este header al browser (`proxy_controller.rb`).

### Patrón `#apiFetch` correcto (copiar en TODO controller)

```js
async #apiFetch(url, options = {}) {
  const isFESync = (options.headers?.['API'] ?? 'ApiAppUrl') === 'ApiFEUrl';

  // Token: FE Sync server usa su propio token (sessionStorage.currentFEUser)
  //        App server usa el token principal de sesión (localStorage.Session)
  const token = isFESync
    ? (JSON.parse(sessionStorage.getItem('currentFEUser') || '{}')?.access_token ?? null)
    : (Storage.get('Session') || {}).access_token;

  const company   = SStore.get('CurrentCompany');
  const companyId = company?.companyId ?? this.#companyId;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':             'application/json',
      'API':                      'ApiAppUrl',
      'X-Skip-Error-Interceptor': 'true',
      ...(token     ? { Authorization:   `Bearer ${token}` } : {}),
      ...(companyId ? { 'Cl-Company-Id': String(companyId) } : {}),
      ...(options.headers || {}),
    },
  });

  const clMessage = response.headers.get('cl-message');
  const decodedMessage = clMessage ? (() => {
    try { return decodeURIComponent(clMessage); } catch { return clMessage; }
  })() : null;

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(decodedMessage || text || `HTTP ${response.status}`);
  }

  const hasBody = response.status !== 204 &&
                  response.headers.get('content-length') !== '0' &&
                  response.headers.get('content-type')?.includes('application/json');
  if (!hasBody) return { Message: decodedMessage || null };

  const json = await response.json();
  if (decodedMessage && !json.Message) json.Message = decodedMessage;
  return json;
}
```

### Dos backends — el header `API` determina a cuál enruta el proxy

Existen dos servidores backend distintos. El proxy Rails lee el header `API` para decidir el destino:

| Header `API` | Backend | Config | Uso |
|---|---|---|---|
| `ApiAppUrl` (default) | App server | `api_fe_app_url` | Usuarios, empresas, permisos, catálogos, documentos GET/search |
| `ApiFEUrl` | Sync/FE server | `api_fe_sync_url` | Emisión, Hacienda, reprocesar, anular, cambios de estado |

Verificar qué header usa el servicio Angular legacy (`documents.service.ts`) antes de implementar cada llamada.
Si una llamada usa `'API': 'ApiAppUrl'` en Angular → no se pasa nada extra (es el default de `#apiFetch`).
Si usa `'API': 'ApiFEUrl'` → pasar `headers: { 'API': 'ApiFEUrl' }` en las options de `#apiFetch`.

```js
// Endpoint en App server (default — no se necesita header extra)
await this.#apiFetch('/api/Rol/GetRoles?companyId=1')

// Endpoint en Sync/FE server — requiere header explícito
await this.#apiFetch('/api/Documents/123/Reprocess?...', {
  method: 'PATCH',
  body: JSON.stringify({}),
  headers: { 'API': 'ApiFEUrl' },
})
```

### ⚠️ Error: 404 en endpoints de emisión/Hacienda

**Síntoma:** La llamada devuelve 404 aunque el path parece correcto.
**Causa:** El endpoint vive en el servidor `ApiFEUrl` pero se envía sin el header → el proxy lo manda al server equivocado.
**Verificación:** Buscar el método en `documents.service.ts` y confirmar qué valor tiene `'API'` en sus headers.

### Reglas

- **SIEMPRE** enviar `Cl-Company-Id` — el proxy lo reenvía transparente al backend; sin él, la API no sabe a qué empresa corresponde la solicitud.
- **NUNCA** ignorar `cl-message` — es donde vive el mensaje real de la API.
- Para errores (non-2xx): usar `decodedMessage` como mensaje primario.
- **NUNCA** llamar `.json()` sin verificar body — las escrituras frecuentemente devuelven `204`.

### ⚠️ Error: `response.json()` en respuestas 204 No Content

**Síntoma:** Una acción (POST/PATCH/DELETE) lanza una excepción del tipo `SyntaxError: Unexpected end of JSON input` o similar, aunque la operación fue exitosa en el servidor.
**Causa:** El endpoint devuelve `204 No Content` (sin body) y el código llama `.json()` directamente.
**Patrón incorrecto:**
```js
const json = await response.json(); // ❌ explota si status === 204
```
**Fix — usar el guard `hasBody` antes de parsear:**
```js
const hasBody = response.status !== 204 &&
                response.headers.get('content-length') !== '0' &&
                response.headers.get('content-type')?.includes('application/json');
if (!hasBody) return { Message: decodedMessage || null };

const json = await response.json(); // ✅ solo si hay body
```
Este guard ya está incluido en el patrón `#apiFetch` canónico de arriba — copiar íntegro, nunca recortar.

### ⚠️ Error silencioso más frecuente

**Síntoma:** La API devuelve 401/403 o datos vacíos aunque el usuario está autenticado.
**Causa probable:** Falta el header `Cl-Company-Id`.
**Verificación:** Abrir DevTools → Network → inspeccionar la request y confirmar que el header está presente.

---

## 7. Notificaciones toast — `showToast`

```js
import { showToast } from 'vendor/clavisco/alerts'
showToast(message, type = 'success', duration = 4000)
// type: 'success' | 'error' | 'warning' | 'info'
```

- **NO** declarar `toast`, `toastIcon`, `toastMessage` en `static targets` — son legacy.
- **NO** agregar divs `data-xxx-target="toast"` en las views — el layout ya tiene `#toast-container`.
- Implementación en `app/javascript/vendor/clavisco/alerts/index.js`.

---

## 8. Paneles laterales vs Modales

| Caso de uso | Componente |
|---|---|
| Formulario de creación/edición complejo | **Panel lateral** |
| Formulario anidado | **Panel lateral** |
| Vista de detalle / previsualización de documento | **Panel lateral** |
| Modal de Angular legacy con contenido extenso | **Panel lateral** |
| Confirmación de acción destructiva | **Modal** |
| Mensaje de error grave | **Modal** |
| Notificación no bloqueante | **Toast** |

Nunca usar modal para formularios de creación, edición o previsualización de contenido.

### Regla de migración desde Angular

Toda `MatDialog` / modal de Angular legacy que muestre **formularios, detalles o previsualización** se migra como **panel lateral**.
Solo se conserva como modal: confirmaciones destructivas, mensajes de error bloqueantes y advertencias simples (sin contenido extenso).

### Implementación — Panel lateral

```html
<div data-controller-target="panelBackdrop"
     data-action="click->controller#closePanel"
     class="hidden fixed inset-0 z-40 bg-black/40"></div>

<div data-controller-target="panel"
     class="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50
            translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
    <h3 class="text-base font-semibold text-gray-800">Título del panel</h3>
    <button type="button" data-action="click->controller#closePanel"
            class="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors">
      <span class="material-icons text-xl">close</span>
    </button>
  </div>
  <div class="flex-1 overflow-y-auto px-6 py-5"><%# campos %></div>
  <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
    <button type="button" data-action="click->controller#closePanel"
            class="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
      <span class="material-icons text-base">cancel</span>Cancelar
    </button>
    <button type="button" data-action="click->controller#saveFromPanel"
            class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <span class="material-icons text-base">check</span>Guardar
    </button>
  </div>
</div>
```

```js
openPanel()  { this.panelBackdropTarget.classList.remove('hidden'); this.panelTarget.classList.remove('translate-x-full'); document.body.style.overflow = 'hidden'; }
closePanel() { this.panelTarget.classList.add('translate-x-full'); this.panelBackdropTarget.classList.add('hidden'); document.body.style.overflow = ''; }
```

---

## 9. Cuándo usar toast vs modal de error

| Situación | Mecanismo |
|---|---|
| Éxito de escritura (POST/PATCH/DELETE) | Toast `success` |
| Error de escritura (POST/PATCH/DELETE) | **Modal de error** |
| Error/advertencia de lectura (GET) | Toast `error` / `warning` |
| Validación client-side | Toast `warning` |
| Sin permisos | Toast `info` |

- Escritura: errores → modal, éxito → toast.
- Lectura: todo → toast.

---

## 10. Idioma de la interfaz — todo en español

Todo texto visible para el usuario debe estar en **español**: títulos, labels, placeholders,
botones, tooltips, mensajes de toast/modal, encabezados de tabla, textos de librerías externas.

### Tabulator — locale español + íconos en el paginador

```js
import { TABULATOR_LOCALE, TABULATOR_LANGS } from 'controllers/tabulator_locale'

getTableConfig() {
  return { ..., paginationCounter: 'rows', locale: TABULATOR_LOCALE, langs: TABULATOR_LANGS }
}
```

- Botones de navegación usan `<span class="material-icons">` en lugar de texto.
- **NO** dejar "First / Prev / Next / Last / Page Size / Showing … of …" en inglés.
- Reutilizar `TABULATOR_LANGS`; no redefinir labels por tabla.

---

## 11. Tablas Tabulator — altura relativa al contenedor

| Capa | Qué aplicar |
|---|---|
| Card / wrapper externo | `flex-1 min-h-0` |
| Toolbar dentro del cuerpo | `flex-shrink-0` |
| Div contenedor de la tabla | `flex-1 min-h-0` |
| Div target de Tabulator | `class="h-full"` |
| Config Tabulator | `height: '100%'`, `maxHeight: undefined` |

### ⚠️ `maxHeight` debe sobreescribirse explícitamente

El `TabulatorController` base inyecta `maxHeight: "500px"` desde su Stimulus value.
Aunque el child declare `height: '100%'`, la tabla quedará limitada a 500px si no se anula:

```js
getTableConfig() {
  return {
    ...super.getTableConfig(),
    height: '100%',
    maxHeight: undefined,  // ← obligatorio para tablas de altura relativa
    // ...
  };
}
```

Sin `maxHeight: undefined`, la tabla ignora el contenedor flex y se corta a 500px.

```html
<div data-controller="mi-modulo" class="p-6 flex flex-col h-full">
  <div class="mb-4 flex-shrink-0 flex justify-end"><!-- toolbar --></div>
  <div class="flex-1 min-h-0 bg-white rounded-xl shadow-sm border overflow-hidden">
    <div data-mi-modulo-target="table" class="h-full"></div>
  </div>
</div>
```

### Acordeón con dos secciones

```js
toggleSeccion() {
  const collapsed = this.seccionSectionTarget.classList.toggle('hidden');
  this.seccionCardTarget.classList.toggle('flex-1',        !collapsed);
  this.seccionCardTarget.classList.toggle('min-h-0',       !collapsed);
  this.seccionCardTarget.classList.toggle('flex-shrink-0', collapsed);
  if (!collapsed) requestAnimationFrame(() => this.table?.redraw(true));
}
```

### Errores comunes

- `height: '100%'` sin contenedor con altura explícita → tabla colapsa.
- `h-full` en el target sin `min-h-0` en el padre → scroll nunca aparece.
- Inicializar Tabulator dentro de `hidden` → llamar `redraw(true)` al mostrar.
- `import('tabulator-tables')` dinámico → usar siempre import estático.

---

## 13. Extensión de TabulatorController — métodos públicos obligatorios

`TabulatorController` (base) llama internamente a `this.getColumns()` y `this.getTableConfig()`
durante `connect()`. Estos métodos **deben ser públicos** en el controller hijo.

### ⚠️ Error recurrente

```
Error: getColumns() must be implemented by child controller
```

**Causa:** declarar `getColumns` como método privado (`#getColumns`).
**Fix:** siempre usar nombre público sin `#`.

### Patrón correcto

```js
export default class extends TabulatorController {

  // ✅ CORRECTO — público, base controller puede llamarlo
  getTableConfig() {
    return {
      ...super.getTableConfig(),
      height: '100%',
      columns: this.getColumns(),   // ← llamada también pública
      // ...resto de config
    };
  }

  // ✅ CORRECTO — público
  getColumns() {
    return [
      { title: 'Nombre', field: 'Name', widthGrow: 2 },
      // ...
    ];
  }
}
```

### ❌ Patrón incorrecto

```js
export default class extends TabulatorController {



  // ❌ INCORRECTO — privado, el base NO puede llamarlo
  #getColumns() { ... }

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      columns: this.#getColumns(), // ← tampoco funciona desde super
    };
  }
}
```

### Regla

> `getColumns()` y `getTableConfig()` son el contrato entre el controller hijo y la base.
> **Nunca** prefixar con `#`. Cualquier método llamado por la clase base debe ser público.

---

## 14. Layout `protected` — obligatorio en todo controller de páginas autenticadas

Todo controller que sirve una página con menú lateral y toolbar **debe** declarar `layout 'protected'`.
Sin esta línea, Rails usa el layout `application` (solo el HTML base sin menú, sin auth-guard, sin toolbar).

### ⚠️ Síntoma

Al navegar a la página: el menú lateral y el toolbar desaparecen completamente.
La página carga pero parece "desnuda" — solo el contenido sin chrome.

### Causa

Rails hereda el layout desde `ApplicationController`, que usa `application.html.erb`.
El layout con menú, toolbar y auth-guard es `protected.html.erb`.
Si el controller no lo declara explícitamente, no lo obtiene.

### Patrón obligatorio

```ruby
# ✅ CORRECTO — tiene menú y toolbar
module Documents
  class IssuedController < ApplicationController
    layout 'protected'

    def index; end
  end
end
```

```ruby
# ❌ INCORRECTO — página sin menú ni toolbar
module Documents
  class IssuedController < ApplicationController
    def index; end   # usa layout 'application' por defecto
  end
end
```

### Regla

> **Cada** controller nuevo bajo `namespace :configurations`, `namespace :documents`,
> o cualquier namespace de páginas autenticadas **DEBE** incluir `layout 'protected'`
> como primera línea del cuerpo de la clase, antes de cualquier action.

### Verificación rápida

```bash
grep -rn "layout 'protected'" app/controllers/
# Debe aparecer en TODOS los controllers excepto sessions_controller y home_controller
```

---

## 12. Botones de acción primaria en toolbar — alineación y color del botón Cancelar

### Alineación del toolbar

Los botones de acción primaria (Nuevo, Crear, Agregar) se alinean siempre a la **derecha**.

```html
<div class="mb-4 flex-shrink-0 flex justify-end">
  <button type="button" ...>
    <span class="material-icons text-base">add</span>
    Nuevo
  </button>
</div>
```

**Nunca** omitir `flex justify-end` en el div del toolbar.

### Color del botón Cancelar

El botón **Cancelar** usa siempre tono **gris neutro**. El rojo implica acción destructiva y cancelar no lo es.

```html
<%# Correcto %>
<button class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
  Cancelar
</button>

<%# Incorrecto — rojo genera alarma innecesaria %>
<button class="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
  Cancelar
</button>
```

El rojo se reserva para acciones **destructivas e irreversibles** (eliminar, anular).

---

## 16. Diálogos de confirmación — NUNCA alertas nativas del navegador

**Regla:** Está **prohibido** usar `window.confirm()`, `window.alert()` o `window.prompt()` en cualquier parte de la app.
Estas APIs bloquean el hilo principal, no respetan el diseño del sistema y su aspecto varía por OS/browser.

### Patrón obligatorio — `confirm()` del alerts service

```js
import { confirm } from 'vendor/clavisco/alerts'

async #miAccionDestructiva() {
  const confirmed = await confirm('¿Está seguro de que desea eliminar este registro?', 'Eliminar registro')
  if (!confirmed) return

  // ... continuar con la acción
}
```

`confirm(message, title?)` retorna `Promise<boolean>` — usa `await` siempre.
Internamente llama a `showAlert({ type: 'warning', showCancel: true, ... })`.

### Para alertas simples (sin cancelar)

```js
import { showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts'

await showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: 'Descripción del error.' })
```

### ⚠️ Errores comunes

- Usar `window.confirm()` por conveniencia → **reemplazar siempre** con `confirm()` del service.
- Olvidar `await` → el código continúa sin esperar la respuesta del usuario.

---

## 15. Loaders — tres tipos estándar

Existen exactamente tres tipos de loader en la app. No inventar variantes nuevas.

### Tipo A — Overlay bloqueante (partial ERB)

Para operaciones que bloquean la interacción con la página (guardar, procesar, cambiar empresa).
Se renderiza con el partial `shared/overlay_loader`:

```erb
<%= render 'shared/overlay_loader',
      ctrl:       'documents-create',   # controller en kebab-case
      message:    'Guardando...' %>     # texto visible
```

Locals completos:

| Local | Default | Descripción |
|---|---|---|
| `ctrl` | — (requerido) | Nombre del controller en kebab-case |
| `target` | `loadingOverlay` | Nombre del Stimulus target |
| `msg_target` | `loadingMessage` | Target del `<p>` del mensaje. `nil` = mensaje fijo sin target |
| `message` | `Cargando...` | Texto visible |
| `z_class` | `z-50` | Clase z-index. Usar `z-[60]`, `z-[9999]` cuando sea necesario |

El controller lo muestra/oculta con:

```js
this.loadingOverlayTarget.classList.remove('hidden')  // mostrar
this.loadingOverlayTarget.classList.add('hidden')     // ocultar

// Si tiene msg_target, actualizar el mensaje antes de mostrar:
this.loadingMessageTarget.textContent = 'Procesando...'
this.loadingOverlayTarget.classList.remove('hidden')
```

### Tipo B — Overlay global vía JS (overlay service)

Para controllers JS que no tienen una vista ERB propia o necesitan mostrar el loader
desde múltiples puntos de código (ej. `general_configs`, `permissions`).
Usa `showLoading` / `hideLoading` del overlay service:

```js
import { showLoading, hideLoading } from 'vendor/clavisco/overlay'

showLoading('Guardando permisos, espere por favor...')
// ... operación async ...
hideLoading()
```

El overlay global se crea en `document.body` con id `cl-global-loader` y mismo estilo que el partial.

### Tipo C — Table loader (Tabulator)

Para el estado de carga de tablas Tabulator. Usar `TABULATOR_LOADING_HTML` de `tabulator_locale`:

```js
import { TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale'

this.table?.alert(TABULATOR_LOADING_HTML)  // mostrar
this.table?.clearAlert()                   // ocultar
```

### Regla de selección

| Situación | Tipo |
|---|---|
| Operación bloqueante en una vista ERB | **A — partial** |
| Operación bloqueante en controller JS sin vista propia | **B — overlay service** |
| Carga de datos en una tabla Tabulator | **C — TABULATOR_LOADING_HTML** |

**No usar** `animate-spin material-icons autorenew`, `border-b-2 border-blue-600`,
ni `border-4 border-t-transparent` — son patrones legacy ya eliminados.

---

## 17. Paginación remota Tabulator — contador de filas correcto

**Problema:** `paginationCounter: 'rows'` calcula el total como `last_page × pageSize`.
Si la última página no está llena (ej. 154 registros en páginas de 10 → last_page = 16),
Tabulator muestra "160 filas" en la primera carga y corrige a 154 solo al llegar a la última página.

**Causa raíz:** Tabulator no conoce el total real — solo infiere `last_page` del API response.

**Patrón obligatorio para toda tabla con paginación remota:**

```js
// 1. Campo de instancia para guardar el total real
#totalRecords = 0;

// 2. En getTableConfig() — reemplazar paginationCounter: 'rows'
paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
  const total = this.#totalRecords;
  if (!total) return '';
  const to = Math.min(currentRow + _pageSize - 1, total);
  return `Mostrando ${currentRow.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
},

// 3. En #fetchPage() — guardar el total antes de retornar
const total = json.Data[0]?.MaxQtyRowsFetch ?? 0;  // o la propiedad que use la API
this.#totalRecords = total;
const lastPage = Math.max(1, Math.ceil(total / size));
return { data: json.Data, last_page: lastPage };
```

**⚠️ NUNCA usar `paginationCounter: 'rows'`** en tablas con `paginationMode: 'remote'`.

### Paginación remota — migrar de `setData()` local a `ajaxRequestFunc`

Si un controller carga datos con `this.table.setData(records)` (modo local), Tabulator
no puede paginar correctamente en el servidor. El patrón correcto es `ajaxRequestFunc`:

```js
// getTableConfig()
ajaxURL: '/api/MiEndpoint',                              // activa modo remote
ajaxRequestFunc: (_url, _config, params) => this.#fetchPage(params),
ajaxResponse:    (_url, _params, response) => response,

// connect() — super.connect() ya dispara la primera carga, no llamar #fetchPage manualmente
super.connect();

// action público de búsqueda — setData() recarga y vuelve a página 1
search() { this.table?.setData(); }
```



## 18. Edición de archivos — usar las herramientas NATIVAS (Edit/Write), NO Python vía Bash

**Regla:** modificar archivos del proyecto SIEMPRE con las herramientas de archivo **nativas** (`Edit` para reemplazo quirúrgico, `Write` para archivo nuevo o reescritura completa). Estas escriben directo al filesystem de Windows (`C:\...`), de forma atómica.

**Está PROHIBIDO escribir archivos del proyecto con Python, `sed`, redirección `>` u otros medios a través del shell de Bash.** El shell corre en un sandbox aislado que llega a los archivos por un *mount* de red (`/sessions/.../mnt/...`), y ese mount **corrompe las escrituras**.

### Por qué (causa raíz confirmada)

Hay dos caminos distintos hacia los mismos archivos:

| Camino | Cómo escribe | Resultado |
|---|---|---|
| Herramientas nativas `Edit` / `Write` | Directo a `C:\...`, sin intermediario | **Seguro y atómico** |
| Bash (`python open().write()`, `sed -i`, `>`) | A través del mount `/sessions/.../mnt/...` | **Corrompe el archivo** |

Síntomas reales observados al escribir vía el mount:

- **Truncado silencioso** — el archivo queda cortado a la mitad (ej. `users_controller.js` quedó en 962 de 1036 líneas, sin el cierre de clase) por un flush incompleto del mount.
- **Relleno con bytes NUL** — el mount agrega bytes `\0` al final del archivo (ej. `numbering_controller.js`, `CLAUDE.md`). `grep` lo marca como `binary file matches` y el bundler de assets puede fallar.

> ⚠️ La regla anterior de esta sección ("usar SIEMPRE Python vía Bash") era **la causa** de la corrupción, no la solución. Por eso se invierte: en este entorno (Cowork) la herramienta segura es `Edit`/`Write` nativa; lo riesgoso es escribir por el mount de Bash.

### Regla obligatoria

1. Crear o modificar cualquier archivo del proyecto → `Edit` o `Write` nativas. **Nunca** Python / `sed -i` / `>` sobre el mount para escribir.
2. Bash se reserva para **solo lectura** y comandos: `git`, `grep`, `node --check`, `wc`, correr tests, etc.
3. Antes de usar `Edit`, el archivo debe haberse leído con `Read` en la conversación (la herramienta lo exige).
4. `Edit` no se ve afectado por CRLF ni por el tamaño del archivo en este entorno; el problema histórico era el mount, no la herramienta.

### Verificación después de editar (Bash, solo lectura)

```bash
# 1. ¿Quedó algún byte NUL? Debe imprimir "limpio".
grep -qI . app/javascript/controllers/mi_controller.js && echo limpio || echo "NUL/CORRUPTO"

# 2. Sintaxis JS válida
node --check app/javascript/controllers/mi_controller.js

# 3. Conteo de líneas razonable vs HEAD (detecta truncado)
wc -l app/javascript/controllers/mi_controller.js
git show HEAD:app/javascript/controllers/mi_controller.js | wc -l
```

### Señales de archivo corrupto

- `grep` reporta `binary file matches` → el archivo tiene bytes NUL (relleno del mount).
- `tail` muestra el archivo cortado a media función/expresión → truncado.
- El browser lanza `SyntaxError: Private field '#x' must be declared in an enclosing class` → la clase no cerró (truncado).

### Recuperación cuando un archivo ya quedó corrupto / truncado

```bash
# 1. Comparar disco vs HEAD
wc -l app/javascript/controllers/mi_controller.js
git show HEAD:app/javascript/controllers/mi_controller.js | wc -l

# 2. Restaurar el contenido pristino. `git show` lee el blob desde el object store
#    y la redirección '>' restituye el archivo sin el padding del mount (verificado).
git show HEAD:app/javascript/controllers/mi_controller.js > app/javascript/controllers/mi_controller.js
```

Después de restaurar, reaplicar los cambios con `Edit` nativo (no con Python).


---

## 19. Navegación SPA — `Turbo.visit`, NO `window.location.href`

Turbo Drive ya está cargado (`import '@hotwired/turbo-rails'` en `application.js`).
Para navegar entre vistas se usa **`Turbo.visit(ruta)`** (o anclas `<a href>` que
Turbo intercepta), **nunca** `window.location.href`. Turbo reemplaza el `<body>`
sin recargar assets ni perder el `<aside>` permanente del menú → navegación tipo SPA.

`window.location.href` / `location.reload()` hacen un *full reload* del navegador:
descartan el DOM, re-descargan todo y colapsan el menú. Reservarlos SOLO para los
casos que deben re-bootstrapear el estado completo de la app.

### Regla

| Situación | Mecanismo |
|---|---|
| Navegar a otra vista (crear / editar / listar / volver) | **`Turbo.visit(ruta)`** |
| Redirección por guard (sin permiso → `/home`) | `Turbo.visit('/home')` |
| Cambio de empresa | `window.location.reload()` — recarga permisos/empresa y reconstruye el menú |
| Asignación de permisos a un rol | `window.location.reload()` — refresca el estado de permisos |
| Login (post-autenticación) | `window.location.href` — arranque limpio de sesión |
| Logout | `window.location.href = '/login'` — limpia la sesión |
| Sincronización de sesión entre pestañas | `window.location.href` — requiere re-init completo |
| Abrir archivo/PDF en pestaña nueva (`window.open`) | `tab.location.href` — NO es navegación de página |

### Por qué algunos casos SÍ usan reload

El `<aside>` del menú es `data-turbo-permanent`: con `Turbo.visit` no se reconstruye,
por lo que NO reflejaría permisos/empresa nuevos. Tras un **cambio de empresa** o de
**permisos** hay que recargar (`location.reload()`) para que el menú y los catálogos
se reconstruyan con el estado actualizado. Usar `Turbo.visit` ahí dejaría el menú
desincronizado.

### Patrón

```js
// ✅ Navegación pura
Turbo.visit('/configurations/companies')
Turbo.visit(`/configurations/companies/${id}/edit`)

// ✅ Re-bootstrap intencional (cambió el estado global)
window.location.reload()              // cambio de empresa / permisos
window.location.href = '/login'       // logout

// ❌ Navegación con full reload innecesario (parpadeo + colapsa el menú)
window.location.href = '/configurations/companies'
```

### ⚠️ Preferir panel lateral sobre navegar a otra vista

Para crear/editar (ver §8), preferir abrir un **panel lateral** en el mismo listado
en lugar de navegar a `/new` o `/:id/edit`. No hay navegación y el estado del listado
(filtros, página actual) se conserva. Referencia: `connections_controller.js`.

### ⚠️ El menú colapsa al navegar aunque el `<aside>` sea `data-turbo-permanent`

**Síntoma:** los nodos padre expandidos se cierran al navegar con `Turbo.visit`.
**Causa:** al reemplazar el `<body>`, Turbo mueve el `<aside>` permanente al nuevo
body y Stimulus lo trata como **reconexión** → `connect()` corre de nuevo,
`#expandedGroups` (campo de la nueva instancia) nace vacío y `#renderMenu()` borra
el DOM expandido.
**Validación:** `console.log` en `connect()` del `menu_controller` → se dispara en
cada navegación.
**Solución:** el nodo permanente CONSERVA el DOM entre el disconnect y el connect;
en `connect()` se reconstruye `#expandedGroups` leyendo del DOM
(`#captureExpandedFromDom()`) **antes** de re-renderizar, y `#createNodeElement`
respeta ese estado al recrear cada grupo. Sin storage.