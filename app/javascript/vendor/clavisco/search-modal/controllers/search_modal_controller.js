import { Controller } from "@hotwired/stimulus"
import { getAPIHeaders, getMasterDataHeaders } from "lib/api_helpers"

// Replicates @clavisco/search-modal functionality
// Provides: modal search with table results, pagination, selection
export default class extends Controller {
  static targets = [
    "modal", "backdrop", "searchInput", "resultsContainer",
    "table", "tbody", "header", "paginator",
    "loading", "emptyState"
  ]

  static values = {
    title: { type: String, default: "Buscar" },
    placeholder: { type: String, default: "Buscar..." },
    apiUrl: { type: String, default: "" },
    columns: { type: Array, default: [] },
    renameColumns: { type: Object, default: {} },
    valueKey: { type: String, default: "Id" },
    displayKey: { type: String, default: "Name" },
    multiSelect: { type: Boolean, default: false },
    itemsPerPage: { type: Number, default: 10 },
    queryParam: { type: String, default: "filter" }, // Legacy uses FilterBusinessPartner
    minChars: { type: Number, default: 2 },
    debounceTime: { type: Number, default: 200 },
    extraParams: { type: Object, default: {} } // Extra params for URL (e.g., WhsCode, ViewType for Items)
  }

  connect() {
    this.results = []
    this.selectedItems = []
    this.currentPage = 0
    this.totalRecords = 0
    this.isOpen = false
    this.searchDebounceTimer = null

    // Listen for open events on window (to catch events from any controller)
    this.boundOpen = this.open.bind(this)
    window.addEventListener("search-modal:open", this.boundOpen)
  }

  disconnect() {
    window.removeEventListener("search-modal:open", this.boundOpen)
  }

  // Open modal
  open(event) {
    if (event?.detail) {
      // Update config from event
      if (event.detail.apiUrl) this.apiUrlValue = event.detail.apiUrl
      if (event.detail.endpoint) this.apiUrlValue = event.detail.endpoint // alias
      if (event.detail.columns) this.columnsValue = event.detail.columns
      if (event.detail.title) this.titleValue = event.detail.title
      if (event.detail.placeholder) this.placeholderValue = event.detail.placeholder
      if (event.detail.queryParam) this.queryParamValue = event.detail.queryParam
      if (event.detail.multiSelect !== undefined) this.multiSelectValue = event.detail.multiSelect
      if (event.detail.minChars !== undefined) this.minCharsValue = event.detail.minChars
      if (event.detail.debounceTime !== undefined) this.debounceTimeValue = event.detail.debounceTime
      if (event.detail.extraParams) this.extraParamsValue = event.detail.extraParams
      // Store callback for when selection is made
      this.onSelectCallback = event.detail.onSelect
      console.log('[TEMP DEBUG search-modal] Modal opened. Callback stored?', !!this.onSelectCallback, 'Type:', typeof this.onSelectCallback)
    }

    this.isOpen = true
    this.modalTarget.classList.remove("hidden")
    document.body.classList.add("overflow-hidden")

    // Focus search input
    setTimeout(() => {
      this.searchInputTarget.focus()
    }, 100)

    // Angular SearchModalComponent loads ALL items on open (empty ItemCode query)
    // Backend returns all 478 items, frontend paginates them
    this.loadInitialResults()
  }

  // Close modal
  close() {
    this.isOpen = false
    this.modalTarget.classList.add("hidden")
    document.body.classList.remove("overflow-hidden")
    this.reset()
  }

  // Reset state
  reset() {
    this.results = []
    this.selectedItems = []
    this.currentPage = 0
    this.searchInputTarget.value = ""
    this.renderResults()
  }

  // Handle backdrop click
  onBackdropClick(event) {
    if (event.target === this.backdropTarget) {
      this.close()
    }
  }

  // Handle escape key
  onKeydown(event) {
    if (event.key === "Escape") {
      this.close()
    }
  }

  // Handle typeahead search on input (debounced)
  onSearchInput(event) {
    const query = event.target.value.trim()

    // Clear existing debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer)
    }

    // Check if query meets minimum characters
    if (query.length < this.minCharsValue) {
      // Clear results if query is too short
      this.results = []
      this.renderResults()
      return
    }

    // Debounce the search
    this.searchDebounceTimer = setTimeout(() => {
      this.search(event)
    }, this.debounceTimeValue)
  }

  // Load initial results (empty query with backend pagination)
  async loadInitialResults() {
    if (!this.apiUrlValue) return

    this.showLoading()

    try {
      // Empty query to get first page of all items
      this.currentPage = 0
      const url = this.buildSearchUrl("")
      const response = await fetch(url, {
        headers: this.getHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.results = data.Data || data.data || []
        // Read total from response headers (cl-sl-pagination-records-count)
        this.totalRecords = parseInt(response.headers.get("cl-sl-pagination-records-count")) || this.results.length
        this.renderResults()
      } else {
        this.showError("Error al cargar")
      }
    } catch (error) {
      console.error("Load error:", error)
      this.showError("Error de conexión")
    } finally {
      this.hideLoading()
    }
  }

  // Search
  async search(event) {
    event?.preventDefault()

    const query = this.searchInputTarget.value.trim()
    if (!query && !this.apiUrlValue) return

    this.showLoading()

    try {
      // Reset to first page when searching
      this.currentPage = 0
      const url = this.buildSearchUrl(query)
      const response = await fetch(url, {
        headers: this.getHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        this.results = data.Data || data.data || []
        // Read total from response headers
        this.totalRecords = parseInt(response.headers.get("cl-sl-pagination-records-count")) || this.results.length
        this.renderResults()
      } else {
        this.showError("Error al buscar")
      }
    } catch (error) {
      console.error("Search error:", error)
      this.showError("Error de conexión")
    } finally {
      this.hideLoading()
    }
  }

  buildSearchUrl(query) {
    let url = this.apiUrlValue
    const separator = url.includes("?") ? "&" : "?"
    // Use configurable query parameter name (legacy uses FilterBusinessPartner)
    url += `${separator}${this.queryParamValue}=${encodeURIComponent(query.toUpperCase())}`

    // Add extra parameters if provided (for Items endpoint: WhsCode, ViewType)
    if (this.extraParamsValue) {
      Object.entries(this.extraParamsValue).forEach(([key, value]) => {
        url += `&${key}=${encodeURIComponent(value)}`
      })
    }

    return url
  }

  getHeaders() {
    // Send pagination headers - backend will return paginated results
    return getMasterDataHeaders("búsqueda", {
      page: this.currentPage,
      pageSize: this.itemsPerPageValue
    })
  }

  // Render results
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

    // Columna Opciones al final
    html += `<th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Opciones</th>`

    this.headerTarget.innerHTML = html
  }

  renderBody() {
    if (!this.hasTbodyTarget) return

    const columns = this.getDisplayColumns()
    // Backend already paginated - show all results
    const pageResults = this.results

    let html = ""
    pageResults.forEach((record, index) => {
      html += `<tr class="hover:bg-gray-50 border-b" data-index="${index}">`

      // Data columns
      columns.forEach(col => {
        const value = record[col]
        html += `<td class="px-3 py-2 text-sm text-gray-900">${this.formatValue(value)}</td>`
      })

      // Columna Opciones con botón Seleccionar
      html += `
        <td class="px-3 py-2 text-center">
          <button type="button"
                  class="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  data-action="click->search-modal#selectRow"
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
      <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-700">
            ${total > 0 ? `${start} - ${end} de ${total}` : "0 registros"}
          </span>
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-600">Items por página:</label>
            <select data-action="change->search-modal#changePageSize"
                    class="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="5" ${this.itemsPerPageValue === 5 ? 'selected' : ''}>5</option>
              <option value="10" ${this.itemsPerPageValue === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${this.itemsPerPageValue === 20 ? 'selected' : ''}>20</option>
            </select>
          </div>
        </div>
        <div class="flex space-x-1">
          <button type="button"
                  data-action="click->search-modal#prevPage"
                  ${this.currentPage === 0 ? "disabled" : ""}
                  class="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-icons text-sm">chevron_left</span>
          </button>
          <button type="button"
                  data-action="click->search-modal#nextPage"
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

    // Auto-detect from first result
    if (this.results.length > 0) {
      return Object.keys(this.results[0]).filter(k =>
        !["RowColor", "RowMessage", "CellsMessages"].includes(k)
      ).slice(0, 5) // Limit to 5 columns for modal
    }

    return []
  }

  formatValue(value) {
    if (value === null || value === undefined) return "-"
    if (typeof value === "boolean") return value ? "Sí" : "No"
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  }

  // Selection - Click en botón "Seleccionar" de cada fila
  selectRow(event) {
    event.stopPropagation() // Evitar propagación si la fila también tiene handler

    const index = parseInt(event.currentTarget.dataset.index, 10)
    const record = this.results[index]

    if (!record) {
      console.error('[search-modal] No record found at index', index)
      return
    }

    // Seleccionar el registro
    const result = this.multiSelectValue ? [record] : record

    // Llamar callback si existe
    console.log('[TEMP DEBUG search-modal] About to call callback. Exists?', !!this.onSelectCallback, 'Type:', typeof this.onSelectCallback, 'Result:', result.CardCode || result[0]?.CardCode)
    if (this.onSelectCallback && typeof this.onSelectCallback === "function") {
      console.log('[TEMP DEBUG search-modal] Calling callback NOW')
      this.onSelectCallback(result)
      console.log('[TEMP DEBUG search-modal] Callback completed')
    } else {
      console.log('[TEMP DEBUG search-modal] Callback NOT called - does not exist or wrong type')
    }

    // Dispatch event para controllers que escuchan
    this.dispatch("selected", { detail: { selected: result } })

    // Cerrar modal inmediatamente
    this.close()
  }

  isSelected(record) {
    return this.selectedItems.some(item =>
      item[this.valueKeyValue] === record[this.valueKeyValue]
    )
  }

  // Pagination - fetch new page from backend
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

  // Change page size
  async changePageSize(event) {
    this.itemsPerPageValue = parseInt(event.target.value)
    this.currentPage = 0 // Reset to first page
    await this.fetchCurrentPage()
  }

  // Fetch current page from backend
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

  // Loading state
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

  // Empty state
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
