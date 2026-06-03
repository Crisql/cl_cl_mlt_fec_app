import BaseSlideController from "vendor/clavisco/base/controllers/base_slide_controller"
import { getAPIHeaders } from "lib/api_helpers"

/**
 * Slide Search Panel Controller - Mobile-friendly alternative to modal search
 * Features: slide-in from right, swipe to close, better mobile UX
 * Includes responsive sidebar adjustment for desktop
 *
 * @extends BaseSlideController
 */
export default class extends BaseSlideController {
  static targets = [
    ...BaseSlideController.targets,
    "searchInput", "resultsContainer",
    "table", "tbody", "header", "paginator",
    "loading", "emptyState", "title"
  ]

  static values = {
    ...BaseSlideController.values,
    title: { type: String, default: "Buscar" },
    placeholder: { type: String, default: "Buscar..." },
    apiUrl: { type: String, default: "" },
    columns: { type: Array, default: [] },
    renameColumns: { type: Object, default: {} },
    valueKey: { type: String, default: "Id" },
    displayKey: { type: String, default: "Name" },
    multiSelect: { type: Boolean, default: false },
    itemsPerPage: { type: Number, default: 10 },
    queryParam: { type: String, default: "filter" },
    minChars: { type: Number, default: 0 },
    debounceTime: { type: Number, default: 200 },
    extraParams: { type: Object, default: {} },
    localSearch: { type: Boolean, default: false },  // Enable local filtering instead of API calls
    searchFields: { type: Array, default: [] }  // Fields to search in when using localSearch
    // adjustForElement and adjustElementWidth are inherited from BaseSlideController
  }

  connect() {
    super.connect()

    this.results = []
    this.allResults = []  // Store all results for local search
    this.selectedItems = []
    this.currentPage = 0
    this.totalRecords = 0
    this.searchDebounceTimer = null

    // Listen for open events
    this.boundOpen = this.handleOpenEvent.bind(this)
    window.addEventListener("slide-search:open", this.boundOpen)
  }

  disconnect() {
    super.disconnect()
    window.removeEventListener("slide-search:open", this.boundOpen)
  }

  /**
   * Handle open event
   */
  handleOpenEvent(event) {
    if (event?.detail) {
      // Update config from event
      if (event.detail.apiUrl) this.apiUrlValue = event.detail.apiUrl
      if (event.detail.endpoint) this.apiUrlValue = event.detail.endpoint
      if (event.detail.columns) {
        this.columnsValue = event.detail.columns
        // Build renameColumns from ColumnName/ColumnDisplay format if not explicitly provided
        if (!event.detail.renameColumns && Array.isArray(event.detail.columns) && event.detail.columns.length > 0 && event.detail.columns[0].ColumnDisplay) {
          const renames = {}
          event.detail.columns.forEach(c => {
            if (c.ColumnName && c.ColumnDisplay) renames[c.ColumnName] = c.ColumnDisplay
          })
          this.renameColumnsValue = renames
        }
      }
      if (event.detail.title) this.titleValue = event.detail.title
      if (event.detail.placeholder) this.placeholderValue = event.detail.placeholder
      if (event.detail.queryParam !== undefined) this.queryParamValue = event.detail.queryParam
      if (event.detail.multiSelect !== undefined) this.multiSelectValue = event.detail.multiSelect
      if (event.detail.minChars !== undefined) this.minCharsValue = event.detail.minChars
      if (event.detail.debounceTime !== undefined) this.debounceTimeValue = event.detail.debounceTime
      if (event.detail.extraParams) this.extraParamsValue = event.detail.extraParams
      if (event.detail.renameColumns) this.renameColumnsValue = event.detail.renameColumns
      if (event.detail.localSearch !== undefined) this.localSearchValue = event.detail.localSearch
      if (event.detail.searchFields) this.searchFieldsValue = event.detail.searchFields

      // Store callbacks
      this.onSelectCallback = event.detail.onSelect
      this.headersCallback = event.detail.headers || event.detail.getHeaders

    }

    // Update title
    if (this.hasTitleTarget) {
      this.titleTarget.textContent = this.titleValue
    }

    // Update placeholder
    if (this.hasSearchInputTarget) {
      this.searchInputTarget.placeholder = this.placeholderValue
    }

    // Open slide (inherited from BaseSlideController)
    this.open()

    // Load initial results
    this.loadInitialResults()
  }

  /**
   * Hook: Focus search input when slide opens
   * @override
   */
  onSlideOpened() {
    super.onSlideOpened()
    this.searchInputTarget?.focus()
  }

  /**
   * Hook: Reset state after slide closes
   * @override
   */
  onSlideClosed() {
    super.onSlideClosed()
    this.reset()
  }

  /**
   * Reset state
   */
  reset() {
    this.results = []
    this.selectedItems = []
    this.currentPage = 0
    this.extraParamsValue = {} // Clear extra params from previous searches
    if (this.hasSearchInputTarget) {
      this.searchInputTarget.value = ""
    }
    this.renderResults()
  }

  /**
   * Handle typeahead search (debounced)
   */
  onSearchInput(event) {
    const query = event.target.value.trim()

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer)
    }

    if (query.length < this.minCharsValue) {
      this.results = []
      this.renderResults()
      return
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.search(event)
    }, this.debounceTimeValue)
  }

  /**
   * Load initial results
   */
  async loadInitialResults() {
    if (!this.apiUrlValue) return

    // Don't load initial results when minChars > 0 (matches Angular's MinInputCharacters behavior)
    // The user must type at least minChars characters before the API is called
    if (this.minCharsValue > 0) {
      this.showEmptyState()
      return
    }

    // Don't load initial results for filter-based searches UNLESS localSearch is enabled
    // Examples: MasterDataBusinessPartners/GetbyFilter
    // NOTE: Items search should load initial results to show available items (see slide-search pagination test)
    if (!this.localSearchValue && this.apiUrlValue.includes('GetbyFilter')) {
      this.showEmptyState()
      return
    }

    this.showLoading()

    try {
      this.currentPage = 0
      // If localSearch is enabled, use the apiUrl directly (already has all params)
      const url = this.localSearchValue ? this.apiUrlValue : this.buildSearchUrl("")
      const response = await fetch(url, {
        headers: this.getHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.results = data.Data || data.data || []

        // If local search is enabled, store all results for client-side filtering
        if (this.localSearchValue) {
          this.allResults = this.results
        }

        this.totalRecords = parseInt(response.headers.get("cl-sl-pagination-records-count")) || this.results.length
        this.renderResults()
      } else {
        // Log the response body to diagnose the error
        const errorBody = await response.text().catch(() => "")
        console.error(`[slide-search] Error ${response.status}: ${errorBody}`)
        this.showError(`Error al cargar (${response.status})`)
      }
    } catch (error) {
      console.error("[slide-search] Load error:", error)
      this.showError("Error de conexión")
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Search
   */
  async search(event) {
    event?.preventDefault()

    const query = this.searchInputTarget.value.trim()

    // If local search is enabled, filter locally instead of calling API
    if (this.localSearchValue) {
      this.searchLocally(query)
      return
    }

    if (!query && !this.apiUrlValue) return

    this.showLoading()

    try {
      this.currentPage = 0
      const url = this.buildSearchUrl(query)
      const response = await fetch(url, {
        headers: this.getHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.results = data.Data || data.data || []
        this.totalRecords = parseInt(response.headers.get("cl-sl-pagination-records-count")) || this.results.length
        this.renderResults()
      } else {
        const errorBody = await response.text().catch(() => "")
        console.error(`[slide-search] Error ${response.status}: ${errorBody}`)
        this.showError(`Error al buscar (${response.status})`)
      }
    } catch (error) {
      console.error("[slide-search] Search error:", error)
      this.showError("Error de conexión")
    } finally {
      this.hideLoading()
    }
  }

  /**
   * Search locally in cached results
   */
  searchLocally(query) {
    if (!query) {
      // Show all results if no query
      this.results = this.allResults
    } else {
      // Filter results based on search fields
      const queryLower = query.toLowerCase()
      const fields = this.searchFieldsValue.length > 0 ? this.searchFieldsValue : Object.keys(this.allResults[0] || {})

      this.results = this.allResults.filter(item => {
        return fields.some(field => {
          const value = String(item[field] || "").toLowerCase()
          return value.includes(queryLower)
        })
      })
    }

    this.totalRecords = this.results.length
    this.currentPage = 0
    this.renderResults()
  }

  buildSearchUrl(query) {
    let url = this.apiUrlValue
    const separator = url.includes("?") ? "&" : "?"
    url += `${separator}${this.queryParamValue}=${encodeURIComponent(query.toUpperCase())}`

    if (this.extraParamsValue) {
      Object.entries(this.extraParamsValue).forEach(([key, value]) => {
        url += `&${key}=${encodeURIComponent(value)}`
      })
    }

    return url
  }

  getHeaders() {
    // Use provided headers callback if available
    if (this.headersCallback && typeof this.headersCallback === "function") {
      return this.headersCallback({
        page: this.currentPage,
        pageSize: this.itemsPerPageValue
      })
    }

    // Fallback: use getAPIHeaders which includes Authorization token
    // This ensures requests are always authenticated even if callback is lost
    return getAPIHeaders({
      page: this.currentPage,
      pageSize: this.itemsPerPageValue
    })
  }

  /**
   * Render results
   */
  renderResults() {
    if (this.results.length === 0) {
      this.showEmptyState()
      return
    }

    this.hideEmptyState()
    this.renderHeader()
    this.renderBody()
    this.renderPaginator()
  }

  renderHeader() {
    if (!this.hasHeaderTarget) return

    const columns = this.getDisplayColumns()
    let html = ""

    columns.forEach(col => {
      const display = this.renameColumnsValue[col] || col.replace(/([A-Z])/g, " $1").trim()
      html += `<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">${display}</th>`
    })

    html += `<th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Opciones</th>`

    this.headerTarget.innerHTML = html
  }

  renderBody() {
    if (!this.hasTbodyTarget) return

    const columns = this.getDisplayColumns()
    const pageResults = this.results

    let html = ""
    pageResults.forEach((record, index) => {
      html += `<tr class="hover:bg-gray-50 border-b" data-index="${index}">`

      columns.forEach(col => {
        const value = record[col]
        html += `<td class="px-3 py-2 text-sm text-gray-900">${this.formatValue(value)}</td>`
      })

      html += `
        <td class="px-3 py-2 text-center">
          <button type="button"
                  class="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  data-action="click->slide-search#selectRow"
                  data-index="${index}">
            <span class="material-icons text-sm">check_circle</span>
            <span>Seleccionar</span>
          </button>
        </td>
      `

      html += `</tr>`
    })

    this.tbodyTarget.innerHTML = html
  }

  renderPaginator() {
    if (!this.hasPaginatorTarget) return

    const total = this.totalRecords
    const totalPages = Math.ceil(total / this.itemsPerPageValue)
    const start = this.currentPage * this.itemsPerPageValue + 1
    const end = Math.min((this.currentPage + 1) * this.itemsPerPageValue, total)

    this.paginatorTarget.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-gray-50 border-t gap-3">
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <span class="text-sm text-gray-700">
            ${total > 0 ? `${start} - ${end} de ${total}` : "0 registros"}
          </span>
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-600">Items:</label>
            <select data-action="change->slide-search#changePageSize"
                    class="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="5" ${this.itemsPerPageValue === 5 ? 'selected' : ''}>5</option>
              <option value="10" ${this.itemsPerPageValue === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${this.itemsPerPageValue === 20 ? 'selected' : ''}>20</option>
            </select>
          </div>
        </div>
        <div class="flex space-x-1">
          <button type="button"
                  data-action="click->slide-search#prevPage"
                  ${this.currentPage === 0 ? "disabled" : ""}
                  class="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-icons text-sm">chevron_left</span>
          </button>
          <button type="button"
                  data-action="click->slide-search#nextPage"
                  ${this.currentPage >= totalPages - 1 ? "disabled" : ""}
                  class="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-icons text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    `
  }

  getDisplayColumns() {
    if (this.columnsValue.length > 0) {
      return this.columnsValue.map(c => c.ColumnName || c)
    }

    if (this.results.length > 0) {
      return Object.keys(this.results[0]).filter(k =>
        !["RowColor", "RowMessage", "CellsMessages"].includes(k)
      ).slice(0, 5)
    }

    return []
  }

  formatValue(value) {
    if (value === null || value === undefined) return "-"
    if (typeof value === "boolean") return value ? "Sí" : "No"
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  }

  /**
   * Selection
   */
  selectRow(event) {
    event.stopPropagation()

    const index = parseInt(event.currentTarget.dataset.index, 10)
    const record = this.results[index]

    if (!record) {
      console.error('[slide-search] No record found at index', index)
      return
    }

    const result = this.multiSelectValue ? [record] : record

    if (this.onSelectCallback && typeof this.onSelectCallback === "function") {
      this.onSelectCallback(result)
    }

    this.dispatch("selected", { detail: { selected: result } })

    this.close()
  }

  /**
   * Pagination
   */
  async prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--
      await this.fetchCurrentPage()
    }
  }

  async nextPage() {
    const totalPages = Math.ceil(this.totalRecords / this.itemsPerPageValue)
    if (this.currentPage < totalPages - 1) {
      this.currentPage++
      await this.fetchCurrentPage()
    }
  }

  async changePageSize(event) {
    this.itemsPerPageValue = parseInt(event.target.value)
    this.currentPage = 0
    await this.fetchCurrentPage()
  }

  async fetchCurrentPage() {
    if (!this.apiUrlValue) return

    this.showLoading()

    try {
      const query = this.searchInputTarget.value.trim()
      const url = this.buildSearchUrl(query)
      const response = await fetch(url, {
        headers: this.getHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.results = data.Data || data.data || []
        this.totalRecords = parseInt(response.headers.get("cl-sl-pagination-records-count")) || this.results.length
        this.renderResults()
      } else {
        this.showError("Error al cambiar página")
      }
    } catch (error) {
      console.error("Fetch page error:", error)
      this.showError("Error de conexión")
    } finally {
      this.hideLoading()
    }
  }

  // ============================================
  // UI Helper Methods
  // ============================================

  showLoading() {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.remove("hidden")
    }
  }

  hideLoading() {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.add("hidden")
    }
  }

  showEmptyState() {
    if (this.hasEmptyStateTarget) {
      this.emptyStateTarget.classList.remove("hidden")
    }
    if (this.hasTbodyTarget) {
      this.tbodyTarget.innerHTML = ""
    }
    if (this.hasPaginatorTarget) {
      this.paginatorTarget.innerHTML = ""
    }
  }

  hideEmptyState() {
    if (this.hasEmptyStateTarget) {
      this.emptyStateTarget.classList.add("hidden")
    }
  }

  showError(message) {
    if (this.hasTbodyTarget) {
      this.tbodyTarget.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-8 text-center text-red-500">
            <span class="material-icons text-2xl mb-2">error</span>
            <p>${message}</p>
          </td>
        </tr>
      `
    }
  }
}
