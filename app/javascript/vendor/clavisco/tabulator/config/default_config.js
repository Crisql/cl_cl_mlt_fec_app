/**
 * Default Tabulator Configuration
 *
 * Base configuration object that can be extended by specific implementations.
 *
 * @example
 * import defaultConfig from "vendor/clavisco/tabulator/config/default_config"
 *
 * const myConfig = {
 *   ...defaultConfig,
 *   paginationSize: 20,
 *   customOption: true
 * }
 */

export const defaultConfig = {
  // Layout
  layout: "fitColumns",
  layoutColumnsOnNewData: true,
  responsiveLayout: "collapse",

  // Height
  height: "auto",
  maxHeight: "500px",

  // Pagination
  pagination: true,
  paginationSize: 10,
  paginationSizeSelector: [5, 10, 20, 50, 100],

  // Features
  movableRows: true,
  resizableColumnFit: true,

  // Clipboard
  clipboard: true,
  clipboardCopySelector: "table",
  clipboardCopyHeader: true,

  // Placeholder
  placeholder: "No hay datos disponibles",

  // Locale (Spanish)
  langs: {
    "es-es": {
      "pagination": {
        "page_size": "Tamaño página",
        "first": "Primera",
        "first_title": "Primera Página",
        "last": "Última",
        "last_title": "Última Página",
        "prev": "Anterior",
        "prev_title": "Página Anterior",
        "next": "Siguiente",
        "next_title": "Página Siguiente",
        "all": "Todos",
        "counter": {
          "showing": "Mostrando",
          "of": "de",
          "rows": "filas",
          "pages": "páginas"
        }
      },
      "data": {
        "loading": "Cargando",
        "error": "Error"
      }
    }
  },
  locale: "es-es"
}

/**
 * Column defaults
 * Common settings for all columns
 */
export const columnDefaults = {
  headerSort: false,
  resizable: true,
  tooltip: true
}

/**
 * Common column formatters
 */
export const formatters = {
  /**
   * Format number with 2 decimals
   * @param {Object} cell Tabulator cell
   * @returns {string}
   */
  decimal: (cell) => {
    const value = cell.getValue()
    return parseFloat(value || 0).toFixed(2)
  },

  /**
   * Format currency (Costa Rica Colones)
   * @param {Object} cell Tabulator cell
   * @returns {string}
   */
  currency: (cell) => {
    const value = cell.getValue()
    return `₡${parseFloat(value || 0).toFixed(2)}`
  },

  /**
   * Format percentage
   * @param {Object} cell Tabulator cell
   * @returns {string}
   */
  percentage: (cell) => {
    const value = cell.getValue()
    return `${parseFloat(value || 0).toFixed(2)}%`
  },

  /**
   * Format date (dd/mm/yyyy)
   * @param {Object} cell Tabulator cell
   * @returns {string}
   */
  date: (cell) => {
    const value = cell.getValue()
    if (!value) return ""

    const date = new Date(value)
    return date.toLocaleDateString("es-ES")
  },

  /**
   * Format datetime
   * @param {Object} cell Tabulator cell
   * @returns {string}
   */
  datetime: (cell) => {
    const value = cell.getValue()
    if (!value) return ""

    const date = new Date(value)
    return date.toLocaleString("es-ES")
  }
}

/**
 * Common validators
 */
export const validators = {
  required: "required",
  numeric: "numeric",
  integer: "integer",
  email: "email",
  minLength: (params) => `minLength:${params}`,
  maxLength: (params) => `maxLength:${params}`,
  min: (params) => `min:${params}`,
  max: (params) => `max:${params}`,
  minMax: (min, max) => [`min:${min}`, `max:${max}`]
}

export default defaultConfig
