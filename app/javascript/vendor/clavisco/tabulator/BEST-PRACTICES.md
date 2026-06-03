# Tabulator Controller - Mejores Prácticas

**Fecha**: 2026-01-15
**Componente**: `@clavisco/tabulator`

---

## 📋 Tabla de Contenidos

1. [Editores Dinámicos con editorParams](#editores-dinámicos-con-editorparams)
2. [Layout y Overflow](#layout-y-overflow)
3. [Tipos de Editores Correctos](#tipos-de-editores-correctos)
4. [Race Conditions en Inicialización](#race-conditions-en-inicialización)
5. [Reordenar Filas con Columnas Editables](#reordenar-filas-con-columnas-editables)

---

## Editores Dinámicos con editorParams

### ❌ Problema: editorParams como Objeto Estático

```javascript
getColumns() {
  return [
    {
      field: "warehouse",
      editor: "list",
      editorParams: {
        values: this.getWarehouseValues()  // ❌ Se evalúa UNA VEZ al crear columna
      }
    }
  ]
}
```

**Problema**: Si `getWarehouseValues()` depende de datos que se cargan asincrónicamente (ej. `this.warehousesValue`), puede estar vacío cuando se crea la columna.

**Síntoma**: Dropdown muestra solo "undefined" o está vacío.

---

### ✅ Solución: editorParams como Función Dinámica

```javascript
getColumns() {
  return [
    {
      field: "warehouse",
      editor: "list",
      editorParams: () => ({
        values: this.getWarehouseValues()  // ✅ Se evalúa cada vez que se abre dropdown
      })
    }
  ]
}
```

**Beneficio**: Los valores se obtienen justo antes de abrir el dropdown, garantizando que los datos ya están cargados.

---

### 📌 Cuándo Usar Cada Patrón

| Caso | Usar Objeto | Usar Función |
|------|-------------|--------------|
| Valores estáticos/hardcodeados | ✅ | ✅ |
| Valores de datos cargados asincrónicamente | ❌ | ✅ |
| Valores que cambian dinámicamente por fila | ❌ | ✅ |
| Performance crítica (millones de celdas) | ✅ | ❌ |

**Recomendación**: **Usar función por defecto** a menos que tengas razones de performance específicas.

---

## Layout y Overflow

### ❌ Problema: Tabla Desborda el Contenedor

**Síntoma**: La tabla se extiende más allá del margen derecho, causando scroll horizontal en toda la página.

**Causa**: Contenedor no limita el ancho de la tabla.

```html
<!-- ❌ INCORRECTO -->
<div class="w-full">
  <div class="w-full overflow-x-auto">
    <div data-tabulator-target="table"></div>
  </div>
</div>
```

**Problema**: Si el div padre tiene `w-full` sin límite, puede crecer indefinidamente.

---

### ✅ Solución: Contenedor con max-width y min-width

```html
<!-- ✅ CORRECTO -->
<fieldset style="min-width: 0;">
  <div data-controller="my-table">
    <div class="overflow-x-auto" style="max-width: 100%;">
      <div data-tabulator-target="table"></div>
    </div>
  </div>
</fieldset>
```

**Claves**:
- `min-width: 0` en elementos flexbox previene crecimiento forzado
- `max-width: 100%` en contenedor overflow limita al 100% del padre
- `overflow-x-auto` solo funciona cuando el contenedor tiene ancho limitado

---

### 📐 Configuración de Tabulator para Overflow

```javascript
getTableConfig() {
  return {
    layout: "fitData",        // Ancho natural basado en columnas
    maxHeight: "500px",       // Altura máxima (scroll vertical interno)
    layoutColumnsOnNewData: false,  // No recalcular layout
    responsiveLayout: false   // Desactivar responsive behaviors
  }
}
```

**Resultado**:
- Tabla usa ancho natural de columnas
- Si es más ancha que contenedor → scroll horizontal **interno**
- Si tiene más filas que maxHeight → scroll vertical **interno**
- Resto de la página permanece estática

---

## Tipos de Editores Correctos

### ⚠️ Editor Type "select" No Existe en Tabulator

```javascript
// ❌ INCORRECTO
{
  field: "category",
  editor: "select",  // ❌ Error: No such editor found
  editorParams: { values: {...} }
}
```

**Error en consola**: `Editor Error - No such editor found: select`

---

### ✅ Usar "list" para Dropdowns

```javascript
// ✅ CORRECTO
{
  field: "category",
  editor: "list",  // ✅ Dropdown editor en Tabulator
  editorParams: {
    values: {
      "A": "Categoría A",
      "B": "Categoría B"
    }
  }
}
```

---

### 📚 Editores Comunes en Tabulator

| Tipo de Campo | Editor Correcto | Ejemplo |
|---------------|-----------------|---------|
| Dropdown/Select | `"list"` | Categorías, estados |
| Texto | `"input"` | Nombres, descripciones |
| Número | `"number"` | Cantidades, precios |
| Fecha | `"date"` | Fechas de vencimiento |
| Checkbox | `"tickCross"` | Activo/Inactivo |
| Textarea | `"textarea"` | Comentarios largos |

**Referencia**: https://tabulator.info/docs/6.3/edit

---

## Race Conditions en Inicialización

### ❌ Problema: Tabla se Inicializa Antes de Cargar Datos

```javascript
// ❌ INCORRECTO
connect() {
  super.connect()  // Llama initializeTable() inmediatamente
  this.loadData()  // Carga datos asincrónicamente (llega tarde)
}
```

**Síntoma**: Tabla se inicializa con 0 permisos, columnas no editables, dropdowns vacíos.

---

### ✅ Solución: NO Llamar super.connect() Prematuramente

```javascript
// ✅ CORRECTO
connect() {
  console.log("Controller connected")
  // NO llamar super.connect() aquí
  // La tabla se inicializará cuando el padre llame updateTableConfiguration()
}

// En el controller padre (ej. sales-document)
async loadInitialData() {
  // 1. Cargar datos primero
  await this.loadUserPermissions()
  await this.loadWarehouses()
  await this.loadTaxCodes()

  // 2. DESPUÉS inicializar tabla
  this.initializeTabulatorData()  // Llama updateTableConfiguration()
}
```

**Flujo Correcto**:
1. Controller hijo se conecta pero NO inicializa tabla
2. Controller padre carga todos los datos necesarios
3. Controller padre llama `updateTableConfiguration()` en hijo
4. Hijo inicializa tabla con todos los datos disponibles

---

### 📦 Patrón: Child Controller Sin super.connect()

```javascript
// app/javascript/controllers/my_custom_table_controller.js
import TabulatorController from "../vendor/clavisco/tabulator/controllers/tabulator_controller"

export default class extends TabulatorController {
  static values = {
    warehouses: Array,
    permissions: Array
  }

  connect() {
    console.log("[my-table] Controller connected")
    // ⚠️ NO llamar super.connect() aquí!
    // La tabla se inicializará desde el padre
  }

  getColumns() {
    // Estas propiedades ya estarán disponibles cuando se llame
    const canEdit = this.hasPermission('EditItems')

    return [
      {
        field: "warehouse",
        editor: canEdit ? "list" : false,
        editorParams: () => ({
          values: this.getWarehouseValues()
        })
      }
    ]
  }

  getWarehouseValues() {
    const values = {}
    this.warehousesValue.forEach(wh => {
      values[wh.Code] = wh.Name
    })
    return values
  }

  hasPermission(name) {
    return this.permissionsValue.some(p => p.Name === name)
  }
}
```

---

### 📦 Patrón: Parent Controller Carga Datos

```javascript
// app/javascript/controllers/parent_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.loadInitialData()  // NO await aquí (non-blocking)
  }

  async loadInitialData() {
    try {
      // CRÍTICO: Cargar datos en orden correcto
      await this.loadUserPermissions()  // Primero permisos

      // Luego el resto en paralelo
      await Promise.all([
        this.loadWarehouses(),
        this.loadTaxCodes(),
        this.loadCurrencies()
      ])

      // Finalmente inicializar tabla hijo
      this.initializeChildTable()
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  initializeChildTable() {
    const tableController = this.application.getControllerForElementAndIdentifier(
      this.element.querySelector('[data-controller~="my-custom-table"]'),
      'my-custom-table'
    )

    if (tableController) {
      tableController.updateTableConfiguration({
        warehousesValue: this.warehouses,
        permissionsValue: this.userPermissions
      })
    }
  }
}
```

---

## 🎯 Checklist de Implementación

Antes de implementar una tabla Tabulator customizada, verifica:

### ✅ Editores
- [ ] Uso `"list"` en vez de `"select"` para dropdowns
- [ ] `editorParams` es función si depende de datos async
- [ ] Tipos de editores correctos para cada columna

### ✅ Layout
- [ ] Contenedor padre tiene `min-width: 0` (si es flexbox)
- [ ] Contenedor `overflow-x-auto` tiene `max-width: 100%`
- [ ] Configuré `layout: "fitData"` en tabla
- [ ] Configuré `maxHeight` para scroll vertical

### ✅ Inicialización
- [ ] Controller hijo NO llama `super.connect()` prematuramente
- [ ] Controller padre carga datos ANTES de inicializar tabla
- [ ] Uso `await` para garantizar orden de carga
- [ ] Llamé `updateTableConfiguration()` después de cargar datos

### ✅ Datos
- [ ] Verifiqué nombres correctos de propiedades del backend
- [ ] Agregué logging para debugging (`console.log` de datos cargados)
- [ ] Manejé casos donde datos están vacíos/undefined

---

## 🐛 Troubleshooting

### Problema: Dropdown muestra "undefined"

**Verificar**:
1. ¿`editorParams` es función? → Cambiar de objeto a función
2. ¿Nombres de propiedades correctos? → Verificar estructura del backend
3. ¿Datos cargados? → Agregar `console.log` en `getXxxValues()`

**Script de diagnóstico**:
```javascript
const controller = this.application.getControllerForElementAndIdentifier(
  document.querySelector('[data-controller~="my-table"]'),
  'my-table'
)
console.log('Warehouses:', controller.warehousesValue)
console.log('Values:', controller.getWarehouseValues())
```

---

### Problema: Tabla desborda horizontalmente

**Verificar**:
1. ¿Contenedor tiene `overflow-x-auto`?
2. ¿Contenedor tiene `max-width: 100%`?
3. ¿Padre tiene `min-width: 0`?
4. ¿Layout es `"fitData"`?

**Script de diagnóstico**:
```javascript
const table = document.querySelector('[data-tabulator-target="table"]')
const container = table.closest('.overflow-x-auto')
console.log('Container exists:', !!container)
console.log('Container width:', container?.offsetWidth)
console.log('Table width:', table.offsetWidth)
console.log('Overflows:', table.offsetWidth > container?.offsetWidth)
```

---

### Problema: Columnas no editables

**Verificar**:
1. ¿Permisos cargados? → `console.log(this.permissionsValue)`
2. ¿Race condition? → Tabla inicializó antes de cargar permisos
3. ¿Editor correcto? → Verificar que no sea `false`

**Script de diagnóstico**:
```javascript
const controller = this.application.getControllerForElementAndIdentifier(
  document.querySelector('[data-controller~="my-table"]'),
  'my-table'
)
console.log('Permissions:', controller.permissionsValue?.length)
const columns = controller.table.getColumns()
columns.forEach(col => {
  const def = col.getDefinition()
  if (def.editor && def.editor !== false) {
    console.log(def.field, ':', def.editor)
  }
})
```

---

## Reordenar Filas con Columnas Editables

### ❌ Problema: Conflicto entre Drag & Drop y Edición

Cuando `movableRows: true` está habilitado por defecto, **cualquier click en una celda** puede activar el drag & drop, causando conflictos con la edición.

**Error común**:
```
Uncaught TypeError: Cannot read properties of null (reading 'insertBefore')
    at de.endMove (MoveRows.js:358:40)
```

**Síntoma**: Al hacer click en celdas editables, se activa el drag & drop en vez de la edición, y puede causar errores.

---

### ❌ Solución Incorrecta: Deshabilitar movableRows

```javascript
// ❌ Funciona pero pierdes la funcionalidad de reordenar
getTableConfig() {
  return {
    ...config,
    movableRows: false  // Soluciona el conflicto pero pierdes drag & drop
  }
}
```

---

### ✅ Solución Correcta: Usar un Handle Específico

**Patrón**: Permitir arrastrar **solo desde una columna específica** (típicamente la columna "#"), dejando el resto editable.

#### Paso 1: Configurar movableRowsElementDrag

```javascript
// app/javascript/controllers/my_table_controller.js
getTableConfig() {
  const config = super.getTableConfig()

  return {
    ...config,
    // Habilita reordenar filas
    movableRows: true,
    // CRÍTICO: Solo permite arrastrar desde elementos con esta clase
    movableRowsElementDrag: ".tabulator-row-handle"
  }
}
```

#### Paso 2: Agregar Handle a la Primera Columna

```javascript
getColumns() {
  return [
    // Columna de número de línea sirve como handle
    {
      title: "#",
      field: "id",
      width: 50,
      frozen: true,
      headerSort: false,
      hozAlign: "center",
      resizable: false,
      formatter: (cell) => {
        const value = cell.getValue()
        // CRÍTICO: Agregar clase tabulator-row-handle y cursor visual
        return `<div class="tabulator-row-handle flex items-center justify-center gap-1 cursor-move" title="Arrastrar para reordenar">
                  <span class="text-gray-400" style="font-size: 14px;">⋮⋮</span>
                  <span>${value}</span>
                </div>`
      }
    },

    // Resto de columnas editables sin conflicto
    {
      title: "Nombre",
      field: "name",
      editor: "input"  // ✅ Se puede editar normalmente
    },
    {
      title: "Precio",
      field: "price",
      editor: "number"  // ✅ Se puede editar normalmente
    }
    // ...
  ]
}
```

---

### 🎯 Resultado

Con esta configuración:

- ✅ **Arrastrar desde columna "#"** → Reordena la fila
- ✅ **Click en otras columnas** → Edita la celda (sin conflictos)
- ✅ **Cursor cambia a "move"** en la columna "#" para feedback visual
- ✅ **Tooltip "Arrastrar para reordenar"** en hover

---

### 🎨 Personalizaciones del Handle

#### Opción 1: Solo Ícono (más compacto)

```javascript
formatter: (cell) => {
  const value = cell.getValue()
  return `<div class="tabulator-row-handle cursor-move" title="Arrastrar para reordenar">
            <span style="font-size: 16px;">☰</span>
          </div>`
}
```

#### Opción 2: Material Icons

```javascript
formatter: (cell) => {
  const value = cell.getValue()
  return `<div class="tabulator-row-handle flex items-center gap-1 cursor-move" title="Arrastrar">
            <span class="material-icons text-gray-400" style="font-size: 14px;">drag_indicator</span>
            <span>${value}</span>
          </div>`
}
```

#### Opción 3: Handle en Columna Separada

Si quieres mantener la columna "#" sin handle visual:

```javascript
getColumns() {
  return [
    // Columna dedicada solo para arrastrar
    {
      title: "",
      field: "_dragHandle",
      width: 30,
      frozen: true,
      headerSort: false,
      hozAlign: "center",
      resizable: false,
      formatter: () => {
        return `<div class="tabulator-row-handle cursor-move" title="Arrastrar">
                  <span class="text-gray-400">⋮⋮</span>
                </div>`
      }
    },
    {
      title: "#",
      field: "id",
      width: 50,
      // ... sin handle, solo número
    },
    // ... resto de columnas
  ]
}
```

---

### 📝 Notas Importantes

1. **La clase debe ser exactamente** `.tabulator-row-handle` - Tabulator busca este selector
2. **Agregar `cursor-move`** para feedback visual al usuario
3. **Considerar `frozen: true`** en la columna handle para que siempre esté visible
4. **Usar tooltip** para indicar que se puede arrastrar

---

### 🐛 Troubleshooting

**Problema**: Aún da error al hacer click en celdas editables

**Verificar**:
1. ¿`movableRowsElementDrag` está configurado?
2. ¿La clase es exactamente `tabulator-row-handle`?
3. ¿El formatter retorna HTML con la clase?
4. ¿Recargaste la página después del cambio?

**Script de diagnóstico**:
```javascript
const table = document.querySelector('[data-tabulator-target="table"]')
const controller = // obtener controller
console.log('movableRows:', controller.table.options.movableRows)
console.log('movableRowsElementDrag:', controller.table.options.movableRowsElementDrag)

// Verificar que el handle existe en el DOM
const handles = document.querySelectorAll('.tabulator-row-handle')
console.log('Handles encontrados:', handles.length)
```

---

**Problema**: El drag & drop no funciona

**Verificar**:
1. ¿`movableRows: true` está configurado?
2. ¿La clase `tabulator-row-handle` está presente en el DOM?
3. ¿Estás arrastrando desde la columna correcta?

**Prueba manual**:
- Haz hover sobre la columna "#"
- El cursor debe cambiar a "move" (manita o cruz de flechas)
- Click y arrastra desde esa columna
- Deberías ver una preview de la fila mientras arrastras

---

### 🔄 Renumerar IDs Después de Reordenar

Cuando las filas se reordenan, es importante **renumerar los IDs** para que reflejen la posición visual correcta.

**Caso de uso**: Si tienes una columna "#" que muestra el número de línea secuencial (1, 2, 3...), debe actualizarse cuando se reordena.

#### Implementación en Controller Padre

```javascript
// app/javascript/controllers/parent_controller.js
onLineRowMoved(event) {
  const { row, newPosition } = event.detail

  // Obtener líneas en el nuevo orden
  const tableController = this.getChildTableController()
  if (tableController) {
    this.lines = tableController.getLines()

    // CRÍTICO: Renumerar IDs basado en nueva posición
    this.lines = this.lines.map((line, index) => ({
      ...line,
      Id: index + 1  // O cualquier campo que uses para número de línea
    }))

    console.log('Lines reordered and renumbered:', this.lines.length)

    // Actualizar tabla con IDs renumerados
    tableController.updateTableConfiguration({
      dataValue: this.lines
    })

    // Recalcular totales si es necesario
    this.calculateTotals()
  }
}
```

#### Por Qué Es Importante

1. **Consistencia Visual**: El número mostrado debe coincidir con la posición real
2. **Envío a Backend**: Si el backend usa el índice del array como número de línea, debe estar sincronizado
3. **UX**: El usuario espera ver números secuenciales después de reordenar

#### Ejemplo de Flujo Completo

```
Estado Inicial:
  Id: 1 | Producto A
  Id: 2 | Producto B
  Id: 3 | Producto C

Usuario arrastra fila 3 a posición 1:
  Id: 3 | Producto C  ← Número incorrecto (debería ser 1)
  Id: 1 | Producto A  ← Número incorrecto (debería ser 2)
  Id: 2 | Producto B  ← Número incorrecto (debería ser 3)

Después de renumerar:
  Id: 1 | Producto C  ✅ Correcto
  Id: 2 | Producto A  ✅ Correcto
  Id: 3 | Producto B  ✅ Correcto
```

---

## 6. Checkbox Columns con Single-Click

### 📝 Context

Necesitamos columnas de tipo checkbox con toggle de **un solo click**. El editor nativo `tickCross` de Tabulator requiere **doble-click**, lo cual no es intuitivo para los usuarios.

### ✅ Solución: Helper Vendor Reutilizable

Se creó un helper en `helpers/checkbox-column.js` que usa la **API nativa de Tabulator** para implementar checkboxes con single-click.

#### Características

- ✅ **Single-click** para toggle (no doble-click)
- ✅ **API nativa** Tabulator (formatter + cellClick)
- ✅ **Reutilizable** en cualquier tabla
- ✅ **Iconos personalizables** (☐/☑ por default)
- ✅ **Colores personalizables** (verde/gris por default)
- ✅ **Soporte SAP enums** (tYES/tNO)
- ✅ **Respeta permisos** (editable true/false)
- ✅ **Callbacks opcionales** (onToggle)

#### Uso Básico

```javascript
import { createSAPCheckboxColumn } from "vendor/clavisco/tabulator/helpers/checkbox-column"

// En getColumns()
columns: [
  // Checkbox simple para SAP (soporta tYES/tNO)
  createSAPCheckboxColumn("Bonif.", "TaxOnly", canEdit),

  // Checkbox personalizado
  createCheckboxColumn({
    title: "Activo",
    field: "Active",
    editable: true,
    tooltip: "Marcar como activo/inactivo",
    onToggle: (newValue, row) => {
      console.log('Toggled:', row.Id, newValue)
    }
  })
]
```

#### Presets Disponibles

```javascript
// 1. SAP Checkbox (tYES/tNO support)
createSAPCheckboxColumn(title, field, editable)

// 2. Emoji Checkbox (✅/⬜)
createEmojiCheckboxColumn(title, field, editable)

// 3. Minimal Checkbox (✓/vacío)
createMinimalCheckboxColumn(title, field, editable)

// 4. Custom Checkbox (todas las opciones)
createCheckboxColumn({
  title: "Custom",
  field: "MyField",
  editable: true,
  colors: { checked: '#22c55e', unchecked: '#ef4444' },
  icons: { checked: '✅', unchecked: '❌' },
  fontSize: 20,
  onToggle: (value, row, cell) => { /* custom logic */ }
})
```

### 🔍 Cómo Funciona (API Nativa)

```javascript
// 1. Formatter: Renderiza el ícono visual
formatter: (cell) => {
  const value = cell.getValue()  // ← Método nativo
  const checked = value === true || value === 'tYES'
  const icon = checked ? '☑' : '☐'
  const color = checked ? 'green' : 'gray'

  return `<span style="color: ${color}; cursor: pointer;">${icon}</span>`
}

// 2. cellClick: Toggle al hacer click
cellClick: (e, cell) => {
  const current = cell.getValue()  // ← Método nativo
  const newValue = !isChecked(current)

  cell.setValue(newValue)  // ← Método nativo que DISPARA cellEdited
}
```

### ⚠️ Lo que NO Usar

```javascript
// ❌ tickCross editor - requiere doble-click
{
  field: "TaxOnly",
  editor: "tickCross"  // ← Requiere doble-click para activar
}

// ❌ Funciones globales
{
  formatter: (cell) => {
    return `<span onclick="window.toggle(${cell.getValue()})">☑</span>`
    // ← Mala práctica, contamina global namespace
  }
}

// ❌ Event listeners DOM manuales
{
  formatter: (cell) => {
    const span = document.createElement('span')
    span.addEventListener('click', () => { /* ... */ })
    // ← No necesario, usar cellClick de Tabulator
  }
}
```

### 📊 Testing

El helper está completamente testeado:

```bash
# Unit tests del helper
tests/unit/bonified_toggle.test.js (28 tests)
tests/unit/bonified_products_calculation.test.js (17 tests)

# E2E tests de uso real
tests/e2e/sales-bonified-products.spec.js (3 tests)
```

### 🎯 Casos de Uso

1. **Columnas booleanas**: Active, Selected, Enabled, etc.
2. **SAP Business One**: TaxOnly, Canceled, Closed (enums tYES/tNO)
3. **Multi-select**: Columna de selección para bulk actions
4. **Toggle features**: Flags de configuración en líneas

### 📁 Archivos

```
app/javascript/vendor/clavisco/tabulator/
  helpers/
    checkbox-column.js          ← Helper reutilizable

tests/
  unit/
    bonified_toggle.test.js     ← Unit tests (28)
  e2e/
    sales-bonified-products.spec.js  ← E2E tests (3)

docs/
  BONIF-IMPLEMENTATION.md       ← Documentación detallada
```

### ✅ Ventajas del Approach

| Feature | tickCross | Custom HTML | Helper Vendor |
|---------|-----------|-------------|---------------|
| Single-click | ❌ | ✅ | ✅ |
| API Nativa | ✅ | ❌ | ✅ |
| Reutilizable | ❌ | ❌ | ✅ |
| Sin globals | ✅ | ❌ | ✅ |
| Customizable | ❌ | ✅ | ✅ |
| Mantenible | ✅ | ❌ | ✅ |

---

## 📚 Referencias

- **Tabulator Docs**: https://tabulator.info/docs/6.3
- **Edit Module**: https://tabulator.info/docs/6.3/edit
- **Layout Options**: https://tabulator.info/docs/6.3/layout
- **Stimulus Values API**: https://stimulus.hotwired.dev/reference/values
- **Checkbox Helper**: `helpers/checkbox-column.js`

---

**Última actualización**: 2026-01-16
**Autor**: Equipo Clavisco
**Versión**: 1.1.0
