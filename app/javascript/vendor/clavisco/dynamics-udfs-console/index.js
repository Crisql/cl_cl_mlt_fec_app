/**
 * @clavisco/dynamics-udfs-console - UDF management console
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 *
 * Admin interface for managing User Defined Fields
 */

import { clPrint, CL_DISPLAY, Storage } from 'vendor/clavisco/core'

// ============================================================
// UDF CONSOLE SERVICE
// ============================================================

class UdfConsoleService {
  constructor() {
    this.categories = []
    this.selectedCategory = null
    this.udfs = []
  }

  /**
   * Load all UDF categories
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Array>} Categories list
   */
  async loadCategories(apiUrl = '/api') {
    try {
      const response = await fetch(`${apiUrl}/Udfs/GetCategories`, {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.categories = data.Data || data || []
        return this.categories
      }

      return []

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return []
    }
  }

  /**
   * Load UDFs for a category
   * @param {string} category - Category name
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Array>} UDF list
   */
  async loadUdfs(category, apiUrl = '/api') {
    try {
      this.selectedCategory = category

      const response = await fetch(`${apiUrl}/Udfs/GetByCategory?category=${category}`, {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.udfs = data.Data || data || []
        return this.udfs
      }

      return []

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return []
    }
  }

  /**
   * Create new UDF
   * @param {Object} udf - UDF definition
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Object>} Created UDF
   */
  async createUdf(udf, apiUrl = '/api') {
    try {
      const response = await fetch(`${apiUrl}/Udfs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify(udf)
      })

      if (response.ok) {
        const data = await response.json()
        const newUdf = data.Data || data

        // Refresh UDF list
        if (this.selectedCategory) {
          await this.loadUdfs(this.selectedCategory, apiUrl)
        }

        return { success: true, data: newUdf }
      }

      const error = await response.json()
      throw new Error(error.Message || 'Error creating UDF')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update UDF
   * @param {Object} udf - UDF definition
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Object>} Updated UDF
   */
  async updateUdf(udf, apiUrl = '/api') {
    try {
      const response = await fetch(`${apiUrl}/Udfs/${udf.Id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        },
        body: JSON.stringify(udf)
      })

      if (response.ok) {
        const data = await response.json()
        const updatedUdf = data.Data || data

        // Refresh UDF list
        if (this.selectedCategory) {
          await this.loadUdfs(this.selectedCategory, apiUrl)
        }

        return { success: true, data: updatedUdf }
      }

      const error = await response.json()
      throw new Error(error.Message || 'Error updating UDF')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete UDF
   * @param {number} udfId - UDF ID
   * @param {string} apiUrl - API base URL
   * @returns {Promise<Object>} Delete result
   */
  async deleteUdf(udfId, apiUrl = '/api') {
    try {
      const response = await fetch(`${apiUrl}/Udfs/${udfId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json',
          'cl-company-id': String(Storage.getCompanyId())
        }
      })

      if (response.ok) {
        // Refresh UDF list
        if (this.selectedCategory) {
          await this.loadUdfs(this.selectedCategory, apiUrl)
        }

        return { success: true }
      }

      const error = await response.json()
      throw new Error(error.Message || 'Error deleting UDF')

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get current UDFs
   * @returns {Array} Current UDF list
   */
  getUdfs() {
    return this.udfs
  }

  /**
   * Get categories
   * @returns {Array} Categories list
   */
  getCategories() {
    return this.categories
  }

  /**
   * Create new UDF template
   * @param {string} category - Target category
   * @returns {Object} UDF template
   */
  createTemplate(category) {
    return {
      Category: category || this.selectedCategory,
      FieldName: '',
      DisplayName: '',
      FieldType: 'text',
      Description: '',
      IsRequired: false,
      DefaultValue: '',
      Options: [],
      SortOrder: this.udfs.length + 1,
      IsActive: true
    }
  }
}

// Singleton instance
const udfConsole = new UdfConsoleService()

// ============================================================
// EXPORTS
// ============================================================

export const UdfConsole = udfConsole

export function loadCategories(apiUrl) {
  return udfConsole.loadCategories(apiUrl)
}

export function loadUdfs(category, apiUrl) {
  return udfConsole.loadUdfs(category, apiUrl)
}

export function createUdf(udf, apiUrl) {
  return udfConsole.createUdf(udf, apiUrl)
}

export function updateUdf(udf, apiUrl) {
  return udfConsole.updateUdf(udf, apiUrl)
}

export function deleteUdf(udfId, apiUrl) {
  return udfConsole.deleteUdf(udfId, apiUrl)
}

export function getUdfs() {
  return udfConsole.getUdfs()
}

export function getCategories() {
  return udfConsole.getCategories()
}

export function createTemplate(category) {
  return udfConsole.createTemplate(category)
}

export default {
  UdfConsole,
  loadCategories,
  loadUdfs,
  createUdf,
  updateUdf,
  deleteUdf,
  getUdfs,
  getCategories,
  createTemplate
}
