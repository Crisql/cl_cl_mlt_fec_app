# @clavisco/tabulator

Componente genérico de Tabulator para proyectos Clavisco.

## 📦 Contenido

```
vendor/clavisco/tabulator/
├── controllers/
│   └── tabulator_controller.js    # Controller base genérico
├── styles/
│   └── tabulator.css              # Estilos del componente
├── config/
│   └── default_config.js          # Configuración por defecto
└── README.md                       # Esta documentación
```

## 🚀 Instalación

### 1. Importmap (Rails)

```ruby
# config/importmap.rb
pin "tabulator-tables", to: "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator_esm.min.js"
pin_all_from "app/javascript/vendor/clavisco/tabulator", under: "vendor/clavisco/tabulator"
```

### 2. Stylesheet (Layout)

```erb
<%# app/views/layouts/authenticated.html.erb %>
<%= stylesheet_link_tag "vendor/clavisco/tabulator/styles/tabulator", "data-turbo-track": "reload" %>

<%# SheetJS for Excel export %>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

## 📖 Uso Básico

### 1. Crear Controller Hijo

```javascript
// app/javascript/controllers/my_table_controller.js
import TabulatorController from "vendor/clavisco/tabulator/controllers/tabulator_controller"
import { formatters } from "vendor/clavisco/tabulator/config/default_config"

export default class extends TabulatorController {
  static values = {
    ...TabulatorController.values,
    // Agregar valores específicos
    customData: { type: Array, default: [] }
  }

  // REQUERIDO: Definir columnas
  getColumns() {
    return [
      {
        title: "Nombre",
        field: "name",
        editor: "input",
        validator: ["required"]
      },
      {
        title: "Edad",
        field: "age",
        width: 80,
        editor: "number",
        validator: ["required", "min:0", "max:120"]
      },
      {
        title: "Precio",
        field: "price",
        formatter: formatters.currency,
        hozAlign: "right"
      }
    ]
  }

  // OPCIONAL: Personalizar placeholder
  getPlaceholder() {
    return "No hay registros"
  }

  // OPCIONAL: Personalizar campos de búsqueda
  getSearchFields() {
    return ["name", "age"]
  }
}
```

### 2. Vista HTML

```erb
<!-- app/views/my_module/index.html.erb -->
<div data-controller="my-table"
     data-my-table-data-value="<%= @records.to_json %>"
     class="w-full">

  <!-- Toolbar (opcional) -->
  <div class="mb-4 flex items-center justify-between">
    <input type="text"
           placeholder="Buscar..."
           data-my-table-target="search"
           data-action="input->my-table#search"
           class="border rounded px-3 py-2">

    <div class="flex gap-2">
      <button data-action="click->my-table#exportExcel"
              class="px-3 py-2 bg-green-600 text-white rounded">
        Excel
      </button>
      <button data-action="click->my-table#toggleColumns"
              class="px-3 py-2 bg-gray-100 rounded">
        Columnas
      </button>
    </div>
  </div>

  <!-- Tabla -->
  <div data-my-table-target="table"></div>
</div>
```

## 🎨 Personalización

### Configuración de Tabla

Puedes sobrescribir `getTableConfig()` para personalizar la configuración:

```javascript
getTableConfig() {
  return {
    ...super.getTableConfig(),
    paginationSize: 20,
    maxHeight: "600px",
    placeholder: "Tabla vacía"
  }
}
```

### Columnas con Formatters

```javascript
import { formatters } from "vendor/clavisco/tabulator/config/default_config"

getColumns() {
  return [
    // Número con 2 decimales
    { title: "Cantidad", field: "qty", formatter: formatters.decimal },

    // Moneda (₡)
    { title: "Precio", field: "price", formatter: formatters.currency },

    // Porcentaje
    { title: "Descuento", field: "discount", formatter: formatters.percentage },

    // Fecha
    { title: "Creado", field: "created_at", formatter: formatters.date }
  ]
}
```

### Edición Inline

```javascript
{
  title: "Nombre",
  field: "name",
  editor: "input",                    // Tipo de editor
  validator: ["required"],            // Validaciones
  editorParams: {
    selectContents: true              // Seleccionar contenido al editar
  }
}
```

**Editores disponibles:**
- `input` - Input text
- `number` - Input numérico
- `select` - Dropdown
- `textarea` - Área de texto
- `date` - Date picker
- `autocomplete` - Autocompletado

### Dropdowns (Select)

```javascript
{
  title: "Estado",
  field: "status",
  editor: "select",
  editorParams: {
    values: {
      "pending": "Pendiente",
      "approved": "Aprobado",
      "rejected": "Rechazado"
    }
  }
}
```

### Validadores

```javascript
import { validators } from "vendor/clavisco/tabulator/config/default_config"

{
  title: "Email",
  field: "email",
  editor: "input",
  validator: [
    validators.required,
    validators.email
  ]
}

// Con parámetros
{
  title: "Edad",
  field: "age",
  validator: [
    validators.required,
    validators.numeric,
    validators.min(18),
    validators.max(65)
  ]
}
```

## 📊 API Pública

### Métodos del Controller Base

```javascript
// Datos
this.setData(data)              // Establecer datos
this.getData()                  // Obtener datos
this.addRow(row, top = false)   // Agregar fila
this.updateRow(id, updates)     // Actualizar fila
this.deleteRow(id)              // Eliminar fila

// Filtros
this.clearFilters()             // Limpiar filtros
this.search(event)              // Búsqueda global

// UI
this.redraw()                   // Redibujar tabla
this.exportExcel(event)         // Exportar a Excel
this.toggleColumns(event)       // Toggle visibilidad columnas
this.copySelection()            // Copiar filas seleccionadas

// Toast
this.showToast(type, message)   // Mostrar notificación
```

## 🎯 Eventos

El controller base emite eventos personalizados:

### cell-changed

Cuando se edita una celda:

```javascript
// En vista HTML
<div data-action="tabulator:cell-changed->my-controller#onCellChanged">

// En parent controller
onCellChanged(event) {
  const { field, value, row, rowIndex } = event.detail
  console.log(`Campo ${field} cambió a ${value}`)
}
```

### row-moved

Cuando se reordena una fila (drag & drop):

```javascript
onRowMoved(event) {
  const { row, newPosition } = event.detail
  console.log(`Fila movida a posición ${newPosition}`)
}
```

### toast

Para mostrar notificaciones:

```javascript
onToast(event) {
  const { type, message } = event.detail
  // type: 'success', 'error', 'warning', 'info'
  alert(message)
}
```

## 🎨 Estilos

Los estilos están en `styles/tabulator.css` e incluyen:

- Estilos de Tabulator (desde CDN)
- Context menu custom
- Integración con Tailwind CSS
- Temas responsive

**Personalizar colores:**

```css
/* En tu CSS custom */
.tabulator .tabulator-header {
  background-color: #1e40af; /* Azul */
}

.tabulator .tabulator-row:hover {
  background-color: #f0f9ff; /* Azul claro */
}
```

## 📋 Ejemplos Completos

### Tabla de Ventas (Sales Lines)

Ver: `app/javascript/controllers/sales_lines_table_controller.js`

Características:
- ✅ Inline editing (cantidad, precio, descuento)
- ✅ Dropdowns (impuesto, almacén)
- ✅ Context menu (ubicación, lotes, series, eliminar)
- ✅ Drag & Drop
- ✅ Exportar Excel
- ✅ Búsqueda

### Tabla Simple

```javascript
import TabulatorController from "vendor/clavisco/tabulator/controllers/tabulator_controller"

export default class extends TabulatorController {
  getColumns() {
    return [
      { title: "ID", field: "id", width: 60 },
      { title: "Nombre", field: "name", widthGrow: 2 },
      { title: "Email", field: "email", widthGrow: 1 }
    ]
  }
}
```

## 🔧 Configuración Avanzada

### Frozen Columns

```javascript
{
  title: "Código",
  field: "code",
  frozen: true,        // Congelar a la izquierda
  width: 100
}

{
  title: "Acciones",
  field: "actions",
  frozen: "right",     // Congelar a la derecha
  width: 80
}
```

### Responsive

```javascript
getTableConfig() {
  return {
    ...super.getTableConfig(),
    responsiveLayout: "collapse",  // Colapsar columnas en móvil
    // O "hide" para ocultarlas completamente
  }
}
```

### Context Menu Custom

Ver ejemplo en `sales_lines_table_controller.js` método `showContextMenu()`

## 📚 Recursos

- **Tabulator Docs**: https://tabulator.info/docs/
- **Ejemplos**: Ver `sales_lines_table_controller.js`
- **Issues**: Reportar en repositorio del proyecto

## 🔄 Migración a Submodulo (Futuro)

Este componente está diseñado para convertirse en submódulo Git:

```bash
# Cuando terminen migración, ejecutar:
cd app/javascript/vendor/clavisco/tabulator
git init
git add .
git commit -m "Initial commit: Tabulator component"
git remote add origin https://github.com/clavisco/tabulator-component.git
git push -u origin main

# En proyecto principal
cd app/javascript/vendor/clavisco/
rm -rf tabulator
git submodule add https://github.com/clavisco/tabulator-component.git tabulator
```

## 📝 Changelog

### v1.0.0 (2026-01-14)
- ✅ Controller base genérico
- ✅ Configuración por defecto
- ✅ Estilos integrados
- ✅ Formatters y validators
- ✅ Excel export
- ✅ Search/filter
- ✅ Documentación completa

## 📄 Licencia

Uso interno Clavisco. Todos los derechos reservados.
