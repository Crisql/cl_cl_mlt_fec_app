# Convenciones de UI — FEC Rails Migration

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
| Confirmación de acción destructiva | **Modal** |
| Mensaje de error grave | **Modal** |
| Notificación no bloqueante | **Toast** |

Nunca usar modal para formularios de creación o edición.

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
| Config Tabulator | `height: '100%'` |

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
