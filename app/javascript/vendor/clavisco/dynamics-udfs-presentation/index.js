/**
 * @clavisco/dynamics-udfs-presentation - UDF presentation component
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 *
 * User Defined Fields (UDFs) display and editing
 */

import { clPrint, CL_DISPLAY, Storage } from 'vendor/clavisco/core'

// ============================================================
// UDF TYPES
// ============================================================

export const UDF_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  SELECT: 'select',
  TEXTAREA: 'textarea'
}

// ============================================================
// UDF SERVICE
// ============================================================

class UdfPresentationService {
  constructor() {
    this.udfs = new Map()
    this.values = new Map()
  }

  /**
   * Load UDFs for a specific category/object
   * @param {string} category - UDF category (table name)
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Array>} UDF definitions
   */
  async loadUdfs(category, apiUrl = '/api') {
    try {
      const response = await fetch(`${apiUrl}/Udfs/GetByCategory?category=${category}`, {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        const udfs = data.Data || data || []
        this.udfs.set(category, udfs)
        return udfs
      }

      return []

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return []
    }
  }

  /**
   * Get UDF definitions for category
   * @param {string} category - UDF category
   * @returns {Array} UDF definitions
   */
  getUdfs(category) {
    return this.udfs.get(category) || []
  }

  /**
   * Set UDF value
   * @param {string} category - UDF category
   * @param {string} fieldName - Field name
   * @param {any} value - Field value
   */
  setValue(category, fieldName, value) {
    const key = `${category}:${fieldName}`
    this.values.set(key, value)
  }

  /**
   * Get UDF value
   * @param {string} category - UDF category
   * @param {string} fieldName - Field name
   * @returns {any} Field value
   */
  getValue(category, fieldName) {
    const key = `${category}:${fieldName}`
    return this.values.get(key)
  }

  /**
   * Get all values for category
   * @param {string} category - UDF category
   * @returns {Object} Key-value pairs
   */
  getValues(category) {
    const result = {}
    const prefix = `${category}:`

    for (const [key, value] of this.values) {
      if (key.startsWith(prefix)) {
        const fieldName = key.replace(prefix, '')
        result[fieldName] = value
      }
    }

    return result
  }

  /**
   * Set multiple values
   * @param {string} category - UDF category
   * @param {Object} values - Key-value pairs
   */
  setValues(category, values) {
    for (const [fieldName, value] of Object.entries(values)) {
      this.setValue(category, fieldName, value)
    }
  }

  /**
   * Clear values for category
   * @param {string} category - UDF category
   */
  clearValues(category) {
    const prefix = `${category}:`
    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) {
        this.values.delete(key)
      }
    }
  }

  /**
   * Validate UDF values
   * @param {string} category - UDF category
   * @returns {Object} Validation result
   */
  validate(category) {
    const udfs = this.getUdfs(category)
    const errors = []

    for (const udf of udfs) {
      if (udf.IsRequired) {
        const value = this.getValue(category, udf.FieldName)
        if (value === null || value === undefined || value === '') {
          errors.push({
            field: udf.FieldName,
            message: `${udf.DisplayName || udf.FieldName} es requerido`
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Render UDF input element
   * @param {Object} udf - UDF definition
   * @param {any} value - Current value
   * @returns {string} HTML string
   */
  renderInput(udf, value = '') {
    const commonAttrs = `
      name="${udf.FieldName}"
      id="udf_${udf.FieldName}"
      data-udf-field="${udf.FieldName}"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      ${udf.IsRequired ? 'required' : ''}
    `

    switch (udf.FieldType?.toLowerCase()) {
      case 'checkbox':
      case 'boolean':
        return `<input type="checkbox" ${commonAttrs} ${value ? 'checked' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">`

      case 'number':
      case 'integer':
      case 'decimal':
        return `<input type="number" ${commonAttrs} value="${value || ''}" step="${udf.FieldType === 'decimal' ? '0.01' : '1'}">`

      case 'date':
        return `<input type="date" ${commonAttrs} value="${value || ''}">`

      case 'datetime':
        return `<input type="datetime-local" ${commonAttrs} value="${value || ''}">`

      case 'select':
      case 'dropdown':
        const options = (udf.Options || []).map(opt =>
          `<option value="${opt.Value}" ${opt.Value === value ? 'selected' : ''}>${opt.Label}</option>`
        ).join('')
        return `<select ${commonAttrs}><option value="">Seleccionar...</option>${options}</select>`

      case 'textarea':
        return `<textarea ${commonAttrs} rows="3">${value || ''}</textarea>`

      default:
        return `<input type="text" ${commonAttrs} value="${value || ''}">`
    }
  }

  /**
   * Render complete UDF form section
   * @param {string} category - UDF category
   * @param {Object} values - Current values
   * @returns {string} HTML string
   */
  renderForm(category, values = {}) {
    const udfs = this.getUdfs(category)

    if (udfs.length === 0) {
      return '<p class="text-gray-500 text-center py-4">No hay campos definidos</p>'
    }

    return udfs.map(udf => `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1" for="udf_${udf.FieldName}">
          ${udf.DisplayName || udf.FieldName}
          ${udf.IsRequired ? '<span class="text-red-500">*</span>' : ''}
        </label>
        ${this.renderInput(udf, values[udf.FieldName])}
        ${udf.Description ? `<p class="mt-1 text-sm text-gray-500">${udf.Description}</p>` : ''}
      </div>
    `).join('')
  }
}

// Singleton instance
const udfPresentation = new UdfPresentationService()

// ============================================================
// EXPORTS
// ============================================================

export const UdfPresentation = udfPresentation

export function loadUdfs(category, apiUrl) {
  return udfPresentation.loadUdfs(category, apiUrl)
}

export function getUdfs(category) {
  return udfPresentation.getUdfs(category)
}

export function setValue(category, fieldName, value) {
  udfPresentation.setValue(category, fieldName, value)
}

export function getValue(category, fieldName) {
  return udfPresentation.getValue(category, fieldName)
}

export function getValues(category) {
  return udfPresentation.getValues(category)
}

export function setValues(category, values) {
  udfPresentation.setValues(category, values)
}

export function clearValues(category) {
  udfPresentation.clearValues(category)
}

export function validate(category) {
  return udfPresentation.validate(category)
}

export function renderForm(category, values) {
  return udfPresentation.renderForm(category, values)
}

export default {
  UdfPresentation,
  UDF_TYPES,
  loadUdfs,
  getUdfs,
  setValue,
  getValue,
  getValues,
  setValues,
  clearValues,
  validate,
  renderForm
}
