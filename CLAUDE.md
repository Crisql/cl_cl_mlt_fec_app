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
El tooltip aparece al hacer hover con CSS puro (sin JS).

### Estructura HTML

```html
<div class="relative group inline-block">
  <button type="button"
          data-action="click->controller#handler"
          class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
    <span class="material-icons text-base">edit</span>
  </button>
  <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
               whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white
               opacity-0 group-hover:opacity-100 transition-opacity z-10">
    Editar
  </span>
</div>
```

### Reglas

- Un `div.relative.group` envuelve **cada** botón + su tooltip
- El tooltip siempre va `bottom-full` (aparece arriba del botón)
- `pointer-events-none` en el tooltip para que no interfiera con clicks
- Para filas en la parte inferior de la tabla usar `top-full` en lugar de `bottom-full`

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
