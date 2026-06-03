/**
 * Checkbox Column Helper - Single-Click Toggle
 *
 * Helper para crear columnas de tipo checkbox con toggle de un solo click
 * en Tabulator, sin necesidad de doble-click como el tickCross editor.
 *
 * @module vendor/clavisco/tabulator/helpers/checkbox-column
 */

/**
 * Opciones de configuración para columna checkbox
 * @typedef {Object} CheckboxColumnOptions
 * @property {string} title - Título de la columna
 * @property {string} field - Campo de datos (ej: "TaxOnly", "Active", "Selected")
 * @property {number} [width=70] - Ancho de la columna en píxeles
 * @property {boolean} [editable=true] - Si la columna es editable
 * @property {string} [tooltip] - Tooltip personalizado (opcional)
 * @property {Object} [colors] - Colores personalizados
 * @property {string} [colors.checked='#10b981'] - Color cuando marcado (default: green-500)
 * @property {string} [colors.unchecked='#6b7280'] - Color cuando no marcado (default: gray-500)
 * @property {Object} [icons] - Íconos personalizados
 * @property {string} [icons.checked='☑'] - Ícono cuando marcado (default: U+2611)
 * @property {string} [icons.unchecked='☐'] - Ícono cuando no marcado (default: U+2610)
 * @property {number} [fontSize=18] - Tamaño de fuente en píxeles
 * @property {Function} [onToggle] - Callback cuando se hace toggle (opcional)
 * @property {Array<string>} [truthyValues=['tYES']] - Valores adicionales considerados como "true" (ej: SAP enum)
 */

/**
 * Crear configuración de columna checkbox con single-click toggle
 *
 * @param {CheckboxColumnOptions} options - Opciones de configuración
 * @returns {Object} Configuración de columna Tabulator
 *
 * @example
 * import { createCheckboxColumn } from './vendor/clavisco/tabulator/helpers/checkbox-column.js'
 *
 * // Uso básico
 * const columns = [
 *   createCheckboxColumn({
 *     title: "Bonif.",
 *     field: "TaxOnly",
 *     editable: canEditTaxOnly
 *   })
 * ]
 *
 * @example
 * // Uso con opciones personalizadas
 * const columns = [
 *   createCheckboxColumn({
 *     title: "Activo",
 *     field: "Active",
 *     editable: true,
 *     tooltip: "Marcar como activo/inactivo",
 *     colors: {
 *       checked: '#22c55e',  // green-600
 *       unchecked: '#ef4444' // red-500
 *     },
 *     icons: {
 *       checked: '✅',
 *       unchecked: '❌'
 *     },
 *     onToggle: (newValue, row) => {
 *       console.log('Toggled:', row.Id, newValue)
 *     }
 *   })
 * ]
 *
 * @example
 * // Uso con valores SAP enum
 * const columns = [
 *   createCheckboxColumn({
 *     title: "Cerrado",
 *     field: "DocumentStatus",
 *     editable: false,
 *     truthyValues: ['tYES', 'Y', 'bost_Close']  // SAP enums
 *   })
 * ]
 */
export function createCheckboxColumn(options) {
  // Defaults
  const {
    title,
    field,
    width = 70,
    editable = true,
    tooltip = null,
    colors = {
      checked: '#10b981',    // green-500
      unchecked: '#6b7280'   // gray-500
    },
    icons = {
      checked: '☑',  // U+2611 - ballot box with check
      unchecked: '☐' // U+2610 - ballot box
    },
    fontSize = 18,
    onToggle = null,
    truthyValues = ['tYES']  // SAP enum support
  } = options

  // Validate required fields
  if (!title || !field) {
    throw new Error('CheckboxColumn: title and field are required')
  }

  /**
   * Determinar si un valor es "checked"
   * @param {*} value - Valor a evaluar
   * @returns {boolean}
   */
  function isChecked(value) {
    if (value === true) return true
    if (truthyValues.includes(value)) return true
    return false
  }

  /**
   * Formatter: Renderizar checkbox visual
   */
  function formatter(cell) {
    const value = cell.getValue()
    const checked = isChecked(value)

    const icon = checked ? icons.checked : icons.unchecked
    const color = checked ? colors.checked : colors.unchecked
    const cursor = editable ? 'pointer' : 'default'

    // Tooltip automático o personalizado
    const defaultTooltip = editable
      ? 'Click para marcar/desmarcar'
      : 'Sin permiso para editar'
    const finalTooltip = tooltip || defaultTooltip

    return `<span
              style="font-size: ${fontSize}px; color: ${color}; cursor: ${cursor}; user-select: none;"
              title="${finalTooltip}"
              data-checkbox-field="${field}"
            >${icon}</span>`
  }

  /**
   * cellClick: Toggle value on click
   */
  function cellClick(e, cell) {
    if (!editable) return

    const currentValue = cell.getValue()
    const checked = isChecked(currentValue)
    const newValue = !checked

    console.log(`[checkbox-column] Toggle ${field}:`, {
      old: currentValue,
      checked,
      new: newValue
    })

    // Update cell value - triggers cellEdited event
    cell.setValue(newValue)

    // Call custom callback if provided
    if (onToggle && typeof onToggle === 'function') {
      const row = cell.getRow().getData()
      onToggle(newValue, row, cell)
    }
  }

  // Return Tabulator column configuration
  return {
    title,
    field,
    width,
    hozAlign: 'center',
    headerSort: false,
    resizable: true,
    formatter,
    cellClick: editable ? cellClick : undefined
  }
}

/**
 * Preset: Columna checkbox estilo SAP (valores tYES/tNO)
 *
 * @param {string} title - Título de la columna
 * @param {string} field - Campo de datos
 * @param {boolean} editable - Si es editable
 * @returns {Object} Configuración de columna
 *
 * @example
 * import { createSAPCheckboxColumn } from './vendor/clavisco/tabulator/helpers/checkbox-column.js'
 *
 * const columns = [
 *   createSAPCheckboxColumn("Bonif.", "TaxOnly", canEditTaxOnly)
 * ]
 */
export function createSAPCheckboxColumn(title, field, editable = true) {
  return createCheckboxColumn({
    title,
    field,
    editable,
    truthyValues: ['tYES', 'Y']  // SAP Business One enums
  })
}

/**
 * Preset: Columna checkbox con íconos emoji
 *
 * @param {string} title - Título de la columna
 * @param {string} field - Campo de datos
 * @param {boolean} editable - Si es editable
 * @returns {Object} Configuración de columna
 *
 * @example
 * import { createEmojiCheckboxColumn } from './vendor/clavisco/tabulator/helpers/checkbox-column.js'
 *
 * const columns = [
 *   createEmojiCheckboxColumn("Activo", "IsActive", true)
 * ]
 */
export function createEmojiCheckboxColumn(title, field, editable = true) {
  return createCheckboxColumn({
    title,
    field,
    editable,
    icons: {
      checked: '✅',
      unchecked: '⬜'
    }
  })
}

/**
 * Preset: Columna checkbox minimalista (solo checkmark)
 *
 * @param {string} title - Título de la columna
 * @param {string} field - Campo de datos
 * @param {boolean} editable - Si es editable
 * @returns {Object} Configuración de columna
 *
 * @example
 * import { createMinimalCheckboxColumn } from './vendor/clavisco/tabulator/helpers/checkbox-column.js'
 *
 * const columns = [
 *   createMinimalCheckboxColumn("Sel", "Selected", true)
 * ]
 */
export function createMinimalCheckboxColumn(title, field, editable = true) {
  return createCheckboxColumn({
    title,
    field,
    editable,
    icons: {
      checked: '✓',
      unchecked: ''
    },
    colors: {
      checked: '#10b981',
      unchecked: '#d1d5db'  // gray-300 (casi invisible)
    }
  })
}

export default {
  createCheckboxColumn,
  createSAPCheckboxColumn,
  createEmojiCheckboxColumn,
  createMinimalCheckboxColumn
}
