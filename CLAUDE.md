# Convenciones de UI — FEC Rails Migration

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

Todo campo que tenga botones de acción dentro del input (adjuntar archivo, descargar, toggle password, agregar ítem) usa un **contenedor unificado con borde compartido**, equivalente al `mat-form-field` con `matSuffix` de Angular Material.

### Estructura HTML

```html
<div class="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50">
  <input type="text"
         readonly
         class="flex-1 px-3 py-2 text-sm bg-transparent outline-none cursor-default">
  <button type="button"
          class="self-stretch flex items-center px-2 border-l border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
          title="Acción">
    <span class="material-icons text-base leading-none">attach_file</span>
  </button>
  <button type="button"
          class="self-stretch flex items-center px-2 border-l border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
          title="Descargar">
    <span class="material-icons text-base leading-none">download</span>
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
- Para inputs **editables**: `bg-white` en el wrapper (no `bg-gray-50`).
- Para inputs **readonly**: `bg-gray-50` en el wrapper + `cursor-default` en el input.
- **NO usar `p-2` en botones sufijo** — agrega padding vertical que infla la altura del contenedor. Usar `self-stretch flex items-center px-2` en su lugar: `self-stretch` hace que el botón ocupe la altura del input sin ampliarla, `flex items-center` centra el ícono, `px-2` provee solo padding horizontal.

### Casos de uso

| Campo | Botones sufijo |
|---|---|
| Nombre del Certificado | attach_file · download |
| Logo de la Compañía | attach_file · download |
| Formato de Impresión | attach_file · download · refresh (restablecer, condicional) |
| Conexión de SAP | add (condicional por permiso) |
| CertPin / TokenPass | visibility_off (toggle, posición absoluta dentro del input) |

### Toggle de contraseña (posición absoluta)

Para campos de tipo password el botón va **dentro** del input con `relative` + `absolute`:

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

## 11. Tablas Tabulator — altura relativa al contenedor

Las tablas deben ocupar el **contenedor** que se les asigna, no el viewport ni la página completa.
Para lograrlo se requieren tres capas alineadas:

### Regla obligatoria

| Capa | Qué aplicar |
|---|---|
| Card / wrapper externo (el que crece) | `flex-1 min-h-0` (en layout `flex flex-col`) |
| Cuerpo de sección (si hay toolbar encima) | `flex-1 min-h-0 flex flex-col` |
| Toolbar dentro del cuerpo | `flex-shrink-0` |
| Div contenedor de la tabla | `flex-1 min-h-0` (o altura explícita) |
| Div target de Tabulator | `class="h-full"` |
| Config Tabulator | `height: '100%'` |

### Ejemplo — tabla única, página full-height

```html
<%# Página %>
<div data-controller="mi-modulo" class="p-6 flex flex-col h-full">
  <div class="mb-4 flex-shrink-0"><!-- toolbar/botones --></div>

  <%# Contenedor — ocupa el resto de la altura %>
  <div class="flex-1 min-h-0 bg-white rounded-xl shadow-sm border overflow-hidden">
    <div data-mi-modulo-target="table" class="h-full"></div>
  </div>
</div>
```

### Ejemplo — acordeón con dos secciones

El **card activo** lleva `flex-1 min-h-0` y el **card inactivo** lleva `flex-shrink-0`.
El JS intercambia estas clases al hacer toggle:

```js
toggleSeccion() {
  const collapsed = this.seccionSectionTarget.classList.toggle('hidden');
  this.seccionChevronTarget.classList.toggle('rotate-180', !collapsed);
  // Card crece al expandir, se comprime al colapsar
  this.seccionCardTarget.classList.toggle('flex-1',        !collapsed);
  this.seccionCardTarget.classList.toggle('min-h-0',       !collapsed);
  this.seccionCardTarget.classList.toggle('flex-shrink-0', collapsed);
  // La tabla estaba oculta al init → forzar redibujado
  if (!collapsed) requestAnimationFrame(() => this.table?.redraw(true));
}
```

### ⚠️ Errores comunes

- **`height: '100%'` sin contenedor con altura explícita** → Tabulator lee 0 px y la tabla se colapsa.
- **`h-full` en el target sin `min-h-0` en el padre** → el padre no restringe su alto y el scroll nunca aparece.
- **Inicializar Tabulator dentro de un elemento `hidden`** → el alto calculado es 0; llamar `redraw(true)` al mostrar el elemento resuelve el problema.
- **`import('tabulator-tables')` dinámico** → la instancia se crea de forma asíncrona; si se llama `setData` de inmediato, la tabla todavía no existe. Siempre usar import estático: `import { TabulatorFull } from 'tabulator-tables'`.

---

## 5. Formato de fechas

Todas las fechas se muestran en formato **`yyyy-MM-dd HH:mm:ss`** (ISO 8601 con espacio, igual que `DATE_TIME_FORMAT` del legacy Angular).

### Helper JS (copiar en cada controller que muestre fechas)

```js
/** Formatea fecha como yyyy-MM-dd HH:mm:ss (DATE_TIME_FORMAT del legacy Angular) */
#formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

### Regla

- **NO usar** `toLocaleDateString()` ni `toLocaleString()` para fechas que vienen de la API.
- Solo usar `toLocaleString('es-CR')` para **montos** (ver sección 3).

---

## 6. Manejo de errores de API — header `cl-message`

El backend envía mensajes de error legibles en el header HTTP `cl-message` (URI-encoded).
El proxy Rails reenvía este header al browser (`proxy_controller.rb`).

En Angular, el `HttpAlertInterceptor` leía ese header y lo movía a `response.body.Message`.
En Rails debemos hacer lo mismo manualmente en cada `#apiFetch`.

### Patrón `#apiFetch` correcto (copiar en TODO controller)

```js
async #apiFetch(url, options = {}) {
  const session = Storage.get('Session') || {};
  const token   = session.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':             'application/json',
      'API':                      'ApiAppUrl',
      'X-Skip-Error-Interceptor': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Leer cl-message header (equivalente a HttpAlertInterceptor de Angular).
  // El proxy Rails reenvía este header; contiene el mensaje real de la API encoded en URI.
  const clMessage = response.headers.get('cl-message');
  const decodedMessage = clMessage ? (() => {
    try { return decodeURIComponent(clMessage); } catch { return clMessage; }
  })() : null;

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(decodedMessage || text || `HTTP ${response.status}`);
  }

  // 204 No Content (y cualquier respuesta sin body JSON) — no intentar parsear.
  // Llamar .json() sobre un body vacío lanza "Unexpected end of JSON input".
  const hasBody = response.status !== 204 &&
                  response.headers.get('content-length') !== '0' &&
                  response.headers.get('content-type')?.includes('application/json');
  if (!hasBody) return { Message: decodedMessage || null };

  const json = await response.json();

  // Mover cl-message a json.Message si la respuesta no trae mensaje propio
  if (decodedMessage && !json.Message) {
    json.Message = decodedMessage;
  }

  return json;
}
```

### Reglas

- **NUNCA** ignorar el header `cl-message` en el fetch — es donde vive el mensaje de error real.
- Para errores (non-2xx): usar `decodedMessage` como mensaje primario.
- Para respuestas OK: asignar `decodedMessage` a `json.Message` si el JSON no trae uno.
- **NUNCA** llamar `.json()` sin verificar que la respuesta tiene body** — las operaciones de escritura frecuentemente devuelven `204 No Content`. Verificar `status !== 204`, `content-length !== '0'` y `content-type: application/json` antes de parsear.
- Este patrón reemplaza el `#apiFetch` base de todos los controllers migrados.
- Los controllers ya existentes (`roles_controller.js`, etc.) deben actualizarse al migrar o corregir.

---

## 7. Notificaciones toast — `showToast`

Todos los controllers usan `showToast` importado de `vendor/clavisco/alerts`. **No copiar `#showToast` privado** en controllers nuevos.

### Import

```js
import { showToast } from 'vendor/clavisco/alerts'
```

### Firma

```js
showToast(message, type = 'success', duration = 4000)
// type: 'success' | 'error' | 'warning' | 'info'
```

### Uso

```js
showToast('Rol creado exitosamente.', 'success')
showToast(err.message || 'Error al guardar', 'error')
showToast('Sin permisos para esta acción.', 'info')
```

### Reglas

- **NO** declarar `toast`, `toastIcon`, `toastMessage` en `static targets` — son legacy, ya eliminados.
- **NO** agregar divs `data-xxx-target="toast"` en las views — el layout ya tiene `#toast-container`.
- Los toasts se apilan verticalmente y cada uno se autodestruye independientemente (soporta múltiples simultáneos).
- El mensaje se escapa internamente (XSS-safe) — no usar `.innerHTML` en el llamador.
- La implementación vive en `app/javascript/vendor/clavisco/alerts/index.js` → método `AlertsService.showToast`.

---

## 8. Paneles laterales vs Modales

### Regla general

| Caso de uso | Componente | Razón |
|---|---|---|
| Formulario de creación/edición complejo | **Panel lateral** | Más espacio, no interrumpe el contexto |
| Formulario anidado (ej: crear conexión dentro de compañía) | **Panel lateral** | No bloquea el formulario padre |
| Flujos secundarios (ej: seleccionar ítem, adjuntar archivo) | **Panel lateral** | El usuario puede volver sin perder estado |
| Confirmación de acción destructiva | **Modal** | Requiere decisión explícita antes de continuar |
| Mensaje de error grave que bloquea el flujo | **Modal** | Necesita atención inmediata del usuario |
| Notificación de éxito / advertencia no bloqueante | **Toast** | No interrumpe el flujo |

### Cuándo usar panel lateral

- Crear o editar un sub-recurso desde dentro de otro formulario (e.g. crear conexión SAP dentro del formulario de compañía).
- Cualquier formulario con más de 3-4 campos que en Angular usaba un `MatDialog` con `width: '800px'` o mayor.
- Flujos de selección o configuración que el usuario puede cancelar y volver al estado anterior.

### Cuándo usar modal

- **Solo** para alertas, confirmaciones y mensajes de error que requieren acción explícita del usuario antes de continuar.
- Nunca para formularios de creación o edición.

### Implementación — Panel lateral

```html
<%# Backdrop — cierra el panel al hacer click %>
<div data-controller-target="panelBackdrop"
     data-action="click->controller#closePanel"
     class="hidden fixed inset-0 z-40 bg-black/40">
</div>

<%# Panel deslizable desde la derecha %>
<div data-controller-target="panel"
     class="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50
            translate-x-full transition-transform duration-300 ease-in-out flex flex-col">

  <%# Header %>
  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
    <h3 class="text-base font-semibold text-gray-800">Título del panel</h3>
    <button type="button" data-action="click->controller#closePanel"
            class="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors">
      <span class="material-icons text-xl">close</span>
    </button>
  </div>

  <%# Cuerpo — scrolleable %>
  <div class="flex-1 overflow-y-auto px-6 py-5">
    <%# campos del formulario %>
  </div>

  <%# Footer con botones %>
  <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
    <button type="button" data-action="click->controller#closePanel"
            class="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
      <span class="material-icons text-base">cancel</span>
      Cancelar
    </button>
    <button type="button" data-action="click->controller#saveFromPanel"
            class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <span class="material-icons text-base">check</span>
      Guardar
    </button>
  </div>

</div>
```

### Implementación — métodos en el controller

```js
openPanel() {
  this.panelBackdropTarget.classList.remove('hidden');
  this.panelTarget.classList.remove('translate-x-full');
  document.body.style.overflow = 'hidden';  // evita scroll del fondo
}

closePanel() {
  this.panelTarget.classList.add('translate-x-full');
  this.panelBackdropTarget.classList.add('hidden');
  document.body.style.overflow = '';
}
```

### Reglas

- El panel lleva `translate-x-full` por defecto y se abre quitando esa clase.
- `transition-transform duration-300 ease-in-out` da la animación de deslizamiento.
- `flex-shrink-0` en header y footer para que el cuerpo sea el único elemento scrolleable.
- El backdrop cierra el panel al hacer click (comportamiento estándar).
- `document.body.style.overflow = 'hidden'` mientras el panel está abierto para evitar doble scroll.
- Los targets del panel pertenecen al **mismo controller** del formulario padre — no se requiere un controller separado a menos que la lógica sea muy compleja.

---

## 9. Cuándo usar toast vs modal de error

| Situación | Mecanismo | Ejemplo |
|---|---|---|
| Éxito de escritura (POST/PATCH/DELETE) | Toast `success` | "Rol creado exitosamente." |
| Error de escritura (POST/PATCH/DELETE) | **Modal de error** | Error al guardar, validación server-side |
| Resultado de lectura (GET) vacío o advertencia | Toast `warning` / `info` | "No se encontraron resultados." |
| Error de lectura (GET) | Toast `error` | "Error al cargar los datos." |
| Validación client-side (antes de llamar la API) | Toast `warning` | "Complete los campos requeridos." |
| Sin permisos | Toast `info` | "No cuenta con permisos para esta acción." |

### Regla general

- **Operaciones de escritura** (POST, PATCH, PUT, DELETE): los errores interrumpen el flujo del usuario — usar modal para que el usuario los lea y confirme. El éxito va en toast.
- **Operaciones de lectura** (GET): los errores y advertencias son menos críticos — usar toast.

### Patrón en controllers

```js
// Escritura — éxito: toast, error: modal
async saveRole() {
  try {
    await this.#apiFetch('/api/Rol', { method: 'POST', body: JSON.stringify(payload) })
    showToast('Rol creado exitosamente.', 'success')
  } catch (err) {
    this.#showErrorModal('Error al crear el rol', err.message)
  }
}

// Lectura — todo va a toast
async #loadRoles() {
  try {
    const data = await this.#apiFetch('/api/Rol/GetRoles?companyId=1')
    if (!data.Data?.length) {
      showToast('No se encontraron roles.', 'warning')
    }
  } catch (err) {
    showToast(err.message || 'Error al cargar roles.', 'error')
  }
}
```

---

## 5. Formato de fechas

Todas las fechas se muestran en formato **`yyyy-MM-dd HH:mm:ss`** (ISO 8601 con espacio, igual que `DATE_TIME_FORMAT` del legacy Angular).

### Helper JS (copiar en cada controller que muestre fechas)

```js
/** Formatea fecha como yyyy-MM-dd HH:mm:ss (DATE_TIME_FORMAT del legacy Angular) */
#formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

### Regla

- **NO usar** `toLocaleDateString()` ni `toLocaleString()` para fechas que vienen de la API.
- Solo usar `toLocaleString('es-CR')` para **montos** (ver sección 3).

---

## 6. Manejo de errores de API — header `cl-message`

El backend envía mensajes de error legibles en el header HTTP `cl-message` (URI-encoded).
El proxy Rails reenvía este header al browser (`proxy_controller.rb`).

En Angular, el `HttpAlertInterceptor` leía ese header y lo movía a `response.body.Message`.
En Rails debemos hacer lo mismo manualmente en cada `#apiFetch`.

### Patrón `#apiFetch` correcto (copiar en TODO controller)

```js
async #apiFetch(url, options = {}) {
  const session = Storage.get('Session') || {};
  const token   = session.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':             'application/json',
      'API':                      'ApiAppUrl',
      'X-Skip-Error-Interceptor': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  // 204 No Content (y cualquier respuesta sin body JSON) — no intentar parsear.
  // Llamar .json() sobre un body vacío lanza "Unexpected end of JSON input".
  const hasBody = response.status !== 204 &&
                  response.headers.get('content-length') !== '0' &&
                  response.headers.get('content-type')?.includes('application/json');
  if (!hasBody) return { Message: decodedMessage || null };

  const json = await response.json();

  if (decodedMessage && !json.Message) {
    json.Message = decodedMessage;
  }

  return json;
}
```

### Reglas

- **NUNCA** ignorar el header `cl-message` en el fetch — es donde vive el mensaje de error real.
- Para errores (non-2xx): usar `decodedMessage` como mensaje primario.
- Para respuestas OK: asignar `decodedMessage` a `json.Message` si el JSON no trae uno.
- **NUNCA** llamar `.json()` sin verificar que la respuesta tiene body — las operaciones de escritura frecuentemente devuelven `204 No Content`. Verificar `status !== 204`, `content-length !== '0'` y `content-type: application/json` antes de parsear.
- Este patrón reemplaza el `#apiFetch` base de todos los controllers migrados.
- Los controllers ya existentes (`roles_controller.js`, etc.) deben actualizarse al migrar o corregir.

---

## 7. Notificaciones toast — `showToast`

Todos los controllers usan `showToast` importado de `vendor/clavisco/alerts`. **No copiar `#showToast` privado** en controllers nuevos.

### Import

```js
import { showToast } from 'vendor/clavisco/alerts'
```

### Firma

```js
showToast(message, type = 'success', duration = 4000)
// type: 'success' | 'error' | 'warning' | 'info'
```

### Uso

```js
showToast('Rol creado exitosamente.', 'success')
showToast(err.message || 'Error al guardar', 'error')
showToast('Sin permisos para esta acción.', 'info')
```

### Reglas

- **NO** declarar `toast`, `toastIcon`, `toastMessage` en `static targets` — son legacy, ya eliminados.
- **NO** agregar divs `data-xxx-target="toast"` en las views — el layout ya tiene `#toast-container`.
- Los toasts se apilan verticalmente y cada uno se autodestruye independientemente (soporta múltiples simultáneos).
- El mensaje se escapa internamente (XSS-safe) — no usar `.innerHTML` en el llamador.
- La implementación vive en `app/javascript/vendor/clavisco/alerts/index.js` → método `AlertsService.showToast`.

---

## 8. Paneles laterales vs Modales

### Regla general

| Caso de uso | Componente | Razón |
|---|---|---|
| Formulario de creación/edición complejo | **Panel lateral** | Más espacio, no interrumpe el contexto |
| Formulario anidado (ej: crear conexión dentro de compañía) | **Panel lateral** | No bloquea el formulario padre |
| Flujos secundarios (ej: seleccionar ítem, adjuntar archivo) | **Panel lateral** | El usuario puede volver sin perder estado |
| Confirmación de acción destructiva | **Modal** | Requiere decisión explícita antes de continuar |
| Mensaje de error grave que bloquea el flujo | **Modal** | Necesita atención inmediata del usuario |
| Notificación de éxito / advertencia no bloqueante | **Toast** | No interrumpe el flujo |

### Cuándo usar panel lateral

- Crear o editar un sub-recurso desde dentro de otro formulario (e.g. crear conexión SAP dentro del formulario de compañía).
- Cualquier formulario con más de 3-4 campos que en Angular usaba un `MatDialog` con `width: '800px'` o mayor.
- Flujos de selección o configuración que el usuario puede cancelar y volver al estado anterior.

### Cuándo usar modal

- **Solo** para alertas, confirmaciones y mensajes de error que requieren acción explícita del usuario antes de continuar.
- Nunca para formularios de creación o edición.

### Implementación — Panel lateral

```html
<%# Backdrop %>
<div data-controller-target="panelBackdrop"
     data-action="click->controller#closePanel"
     class="hidden fixed inset-0 z-40 bg-black/40">
</div>

<%# Panel deslizable desde la derecha %>
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

  <div class="flex-1 overflow-y-auto px-6 py-5">
    <%# campos del formulario %>
  </div>

  <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
    <button type="button" data-action="click->controller#closePanel"
            class="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
      <span class="material-icons text-base">cancel</span>
      Cancelar
    </button>
    <button type="button" data-action="click->controller#saveFromPanel"
            class="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <span class="material-icons text-base">check</span>
      Guardar
    </button>
  </div>
</div>
```

### Implementación — métodos en el controller

```js
openPanel() {
  this.panelBackdropTarget.classList.remove('hidden');
  this.panelTarget.classList.remove('translate-x-full');
  document.body.style.overflow = 'hidden';
}

closePanel() {
  this.panelTarget.classList.add('translate-x-full');
  this.panelBackdropTarget.classList.add('hidden');
  document.body.style.overflow = '';
}
```

### Reglas

- El panel lleva `translate-x-full` por defecto y se abre quitando esa clase.
- `transition-transform duration-300 ease-in-out` da la animación de deslizamiento.
- `flex-shrink-0` en header y footer para que el cuerpo sea el único elemento scrolleable.
- El backdrop cierra el panel al hacer click (comportamiento estándar).
- `document.body.style.overflow = 'hidden'` mientras el panel está abierto para evitar doble scroll.
- Los targets del panel pertenecen al **mismo controller** del formulario padre — no se requiere un controller separado a menos que la lógica sea muy compleja.

---

## 9. Cuándo usar toast vs modal de error

| Situación | Mecanismo | Ejemplo |
|---|---|---|
| Éxito de escritura (POST/PATCH/DELETE) | Toast `success` | "Rol creado exitosamente." |
| Error de escritura (POST/PATCH/DELETE) | **Modal de error** | Error al guardar, validación server-side |
| Resultado de lectura (GET) vacío o advertencia | Toast `warning` / `info` | "No se encontraron resultados." |
| Error de lectura (GET) | Toast `error` | "Error al cargar los datos." |
| Validación client-side (antes de llamar la API) | Toast `warning` | "Complete los campos requeridos." |
| Sin permisos | Toast `info` | "No cuenta con permisos para esta acción." |

### Regla general

- **Operaciones de escritura** (POST, PATCH, PUT, DELETE): los errores interrumpen el flujo del usuario — usar modal para que el usuario los lea y confirme. El éxito va en toast.
- **Operaciones de lectura** (GET): los errores y advertencias son menos críticos — usar toast.

### Patrón en controllers

```js
// Escritura — éxito: toast, error: modal
async saveRole() {
  try {
    await this.#apiFetch('/api/Rol', { method: 'POST', body: JSON.stringify(payload) })
    showToast('Rol creado exitosamente.', 'success')
  } catch (err) {
    this.#showErrorModal('Error al crear el rol', err.message)
  }
}

// Lectura — todo va a toast
async #loadRoles() {
  try {
    const data = await this.#apiFetch('/api/Rol/GetRoles?companyId=1')
    if (!data.Data?.length) {
      showToast('No se encontraron roles.', 'warning')
    }
  } catch (err) {
    showToast(err.message || 'Error al cargar roles.', 'error')
  }
}
```

---

## 10. Idioma de la interfaz — todo en español

**Regla obligatoria:** todo texto visible para el usuario final debe estar en **español**.
Esto incluye, sin limitarse a: títulos, labels, placeholders, botones, tooltips, mensajes
de toast/modal, estados vacíos, encabezados de tabla, y **los textos de componentes de
terceros** (paginadores, contadores, selectores de tamaño de página, etc.).

- **Nunca** dejar textos por defecto en inglés de librerías externas (Tabulator, date pickers, etc.).
- Configurar el `locale` del componente cuando exista; si no, sobreescribir los labels manualmente.

### Tabulator — locale español + íconos en el paginador

Todas las tablas Tabulator deben aplicar el locale compartido. Los botones de navegación
(primera/anterior/siguiente/última) usan **íconos Material Icons** en lugar de texto.

```js
import { TABULATOR_LOCALE, TABULATOR_LANGS } from 'controllers/tabulator_locale'

getTableConfig() {
  return {
    ...,
    paginationCounter: 'rows',
    locale: TABULATOR_LOCALE,   // 'es-es'
    langs:  TABULATOR_LANGS,    // labels español + íconos de flecha
  }
}
```

La definición vive en `app/javascript/controllers/tabulator_locale.js`:

- `first` → `first_page`, `prev` → `chevron_left`, `next` → `chevron_right`, `last` → `last_page`
  (renderizados como `<span class="material-icons">`; Tabulator asigna el label vía `innerHTML`).
- `page_size` → "Filas por página", contador → "Mostrando X a Y de Z filas".
- Los `*_title` (tooltips) también en español: "Primera página", "Página anterior", etc.

### Regla

- **NO** dejar "First / Prev / Next / Last / Page Size / Showing … of …" en inglés.
- Reutilizar `TABULATOR_LANGS`; no redefinir labels por tabla.
