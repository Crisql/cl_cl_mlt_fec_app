import { Controller } from "@hotwired/stimulus"

// Replicates @clavisco/table functionality
// Provides: pagination, sorting, selection, action buttons, search
export default class extends Controller {
  static targets = [
    "table", "tbody", "header", "row", "selectAll", "checkbox",
    "paginator", "pageInfo", "pageSize", "prevButton", "nextButton",
    "searchInput", "emptyState", "loading"
  ]

  static values = {
    records: { type: Array, default: [] },
    columns: { type: Array, default: [] },
    renameColumns: { type: Object, default: {} },
    ignoreColumns: { type: Array, default: [] },
    itemsPerPage: { type: Number, default: 10 },
    currentPage: { type: Number, default: 0 },
    recordsCount: { type: Number, default: 0 },
    pageSizeOptions: { type: Array, default: [5, 10, 20] },
    hasSelection: { type: Boolean, default: false },
    selectionType: { type: String, default: "checkbox" }, // checkbox or radio
    hasPaginator: { type: Boolean, default: true },
    sorting: { type: Boolean, default: false },
    scrollHeight: { type: String, default: "auto" },
    id: { type: String, default: "" },
    buttons: { type: Array, default: [] },
    checkboxColumns: { type: Array, default: [] },
    rowColorProperty: { type: String, default: "RowColor" }
  }

  connect() {
    this.selectedItems = []
    this.sortColumn = null
    this.sortDirection = "asc"
    this.filteredRecords = [...this.recordsValue]

    this.render()
  }

  recordsValueChanged() {
    this.filteredRecords = [...this.recordsValue]
    this.render()
  }

  columnsValueChanged() {
    this.render()
  }

  // Get display columns (excluding ignored ones)
  get displayColumns() {
    if (this.columnsValue.length > 0) {
      return this.columnsValue.filter(col => !this.ignoreColumnsValue.includes(col.ColumnName || col))
    }

    // Auto-detect from first record
    if (this.recordsValue.length > 0) {
      return Object.keys(this.recordsValue[0])
        .filter(key => !this.ignoreColumnsValue.includes(key))
        .filter(key => key !== "RowColor" && key !== "RowMessage" && key !== "CellsMessages")
    }

    return []
  }

  // Get column display name
  getColumnDisplay(column) {
    const colName = column.ColumnName || column
    if (this.renameColumnsValue[colName]) {
      return this.renameColumnsValue[colName]
    }
    // Split PascalCase
    return colName.replace(/([A-Z])/g, " $1").trim()
  }

  // Get current page records
  get pageRecords() {
    if (!this.hasPaginatorValue) {
      return this.filteredRecords
    }

    const start = this.currentPageValue * this.itemsPerPageValue
    const end = start + this.itemsPerPageValue
    return this.filteredRecords.slice(start, end)
  }

  // Get total pages
  get totalPages() {
    const count = this.recordsCountValue || this.filteredRecords.length
    return Math.ceil(count / this.itemsPerPageValue)
  }

  // Render the table
  render() {
    this.renderHeaders()
    this.renderBody()
    this.renderPaginator()
  }

  renderHeaders() {
    if (!this.hasHeaderTarget) return

    let html = ""

    // Selection column
    if (this.hasSelectionValue) {
      if (this.selectionTypeValue === "checkbox") {
        html += `
          <th class="w-10 px-3 py-3">
            <input type="checkbox"
                   data-table-target="selectAll"
                   data-action="change->table#toggleSelectAll"
                   class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          </th>
        `
      } else {
        html += `<th class="w-10 px-3 py-3"></th>`
      }
    }

    // Data columns
    this.displayColumns.forEach(col => {
      const colName = col.ColumnName || col
      const display = this.getColumnDisplay(col)
      const sortable = this.sortingValue ? "cursor-pointer hover:bg-gray-100" : ""
      const sortIcon = this.getSortIcon(colName)

      html += `
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable}"
            ${this.sortingValue ? `data-action="click->table#sort" data-column="${colName}"` : ""}>
          <div class="flex items-center space-x-1">
            <span>${display}</span>
            ${sortIcon}
          </div>
        </th>
      `
    })

    // Actions column
    if (this.buttonsValue.length > 0) {
      html += `<th class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opciones</th>`
    }

    this.headerTarget.innerHTML = html
  }

  getSortIcon(column) {
    if (!this.sortingValue || this.sortColumn !== column) {
      return ""
    }
    const icon = this.sortDirection === "asc" ? "arrow_upward" : "arrow_downward"
    return `<span class="material-icons text-sm">${icon}</span>`
  }

  renderBody() {
    if (!this.hasTbodyTarget) return

    const records = this.pageRecords

    if (records.length === 0) {
      this.tbodyTarget.innerHTML = `
        <tr>
          <td colspan="${this.getColSpan()}" class="px-6 py-12 text-center text-gray-500">
            <span class="material-icons text-4xl mb-2">inbox</span>
            <p>No hay registros para mostrar</p>
          </td>
        </tr>
      `
      return
    }

    let html = ""
    records.forEach((record, index) => {
      const rowColor = record[this.rowColorPropertyValue] || ""
      const rowStyle = rowColor ? `background-color: ${rowColor}` : ""
      const globalIndex = this.currentPageValue * this.itemsPerPageValue + index

      html += `<tr class="hover:bg-gray-50 border-b" style="${rowStyle}" data-index="${globalIndex}">`

      // Selection column
      if (this.hasSelectionValue) {
        const isSelected = this.isItemSelected(record)
        html += `
          <td class="px-3 py-2">
            <input type="${this.selectionTypeValue}"
                   name="table-selection-${this.idValue}"
                   ${isSelected ? "checked" : ""}
                   data-table-target="checkbox"
                   data-action="change->table#toggleSelection"
                   data-index="${globalIndex}"
                   class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
          </td>
        `
      }

      // Data columns
      this.displayColumns.forEach(col => {
        const colName = col.ColumnName || col
        const value = record[colName]
        const isCheckbox = this.checkboxColumnsValue.includes(colName)

        if (isCheckbox) {
          html += `
            <td class="px-3 py-2">
              <input type="checkbox" ${value ? "checked" : ""} disabled
                     class="rounded border-gray-300 text-blue-600">
            </td>
          `
        } else {
          html += `<td class="px-3 py-2 text-sm text-gray-900">${this.formatValue(value)}</td>`
        }
      })

      // Actions column
      if (this.buttonsValue.length > 0) {
        html += `<td class="px-3 py-2 text-right">`
        html += `<div class="flex justify-end space-x-1">`
        this.buttonsValue.forEach(btn => {
          html += `
            <button type="button"
                    class="p-1 rounded hover:bg-gray-100"
                    style="color: ${btn.Color || '#666'}"
                    title="${btn.Title}"
                    data-action="click->table#buttonClick"
                    data-button-action="${btn.Action}"
                    data-index="${globalIndex}">
              <span class="material-icons text-lg">${btn.Icon}</span>
            </button>
          `
        })
        html += `</div></td>`
      }

      html += `</tr>`
    })

    this.tbodyTarget.innerHTML = html
  }

  renderPaginator() {
    if (!this.hasPaginatorValue || !this.hasPaginatorTarget) return

    const total = this.recordsCountValue || this.filteredRecords.length
    const start = this.currentPageValue * this.itemsPerPageValue + 1
    const end = Math.min((this.currentPageValue + 1) * this.itemsPerPageValue, total)

    this.paginatorTarget.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 bg-white border-t">
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700">Filas por página:</span>
          <select data-action="change->table#changePageSize"
                  class="border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500">
            ${this.pageSizeOptionsValue.map(size =>
              `<option value="${size}" ${size === this.itemsPerPageValue ? "selected" : ""}>${size}</option>`
            ).join("")}
          </select>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700">
            ${total > 0 ? `${start} - ${end} de ${total}` : "0 registros"}
          </span>
          <div class="flex space-x-1">
            <button type="button"
                    data-action="click->table#prevPage"
                    ${this.currentPageValue === 0 ? "disabled" : ""}
                    class="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
              <span class="material-icons">chevron_left</span>
            </button>
            <button type="button"
                    data-action="click->table#nextPage"
                    ${this.currentPageValue >= this.totalPages - 1 ? "disabled" : ""}
                    class="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
              <span class="material-icons">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    `
  }

  getColSpan() {
    let span = this.displayColumns.length
    if (this.hasSelectionValue) span++
    if (this.buttonsValue.length > 0) span++
    return span
  }

  formatValue(value) {
    if (value === null || value === undefined) return "-"
    if (typeof value === "boolean") return value ? "Sí" : "No"
    if (value instanceof Date) return value.toLocaleDateString()
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  }

  // Pagination
  prevPage() {
    if (this.currentPageValue > 0) {
      this.currentPageValue--
      this.render()
      this.dispatchPageChange()
    }
  }

  nextPage() {
    if (this.currentPageValue < this.totalPages - 1) {
      this.currentPageValue++
      this.render()
      this.dispatchPageChange()
    }
  }

  goToPage(page) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPageValue = page
      this.render()
      this.dispatchPageChange()
    }
  }

  changePageSize(event) {
    this.itemsPerPageValue = parseInt(event.target.value, 10)
    this.currentPageValue = 0
    this.render()
    this.dispatchPageChange()
  }

  dispatchPageChange() {
    this.dispatch("pageChange", {
      detail: {
        currentPage: this.currentPageValue,
        itemsPerPage: this.itemsPerPageValue,
        slStart: this.currentPageValue * this.itemsPerPageValue,
        slEnd: (this.currentPageValue + 1) * this.itemsPerPageValue
      }
    })
  }

  // Sorting
  sort(event) {
    const column = event.currentTarget.dataset.column

    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
    } else {
      this.sortColumn = column
      this.sortDirection = "asc"
    }

    this.filteredRecords.sort((a, b) => {
      const aVal = a[column]
      const bVal = b[column]

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const comparison = aVal < bVal ? -1 : 1
      return this.sortDirection === "asc" ? comparison : -comparison
    })

    this.render()
  }

  // Selection
  toggleSelectAll(event) {
    const checked = event.target.checked

    if (checked) {
      this.selectedItems = [...this.filteredRecords]
    } else {
      this.selectedItems = []
    }

    this.render()
    this.dispatchSelectionChange()
  }

  toggleSelection(event) {
    const index = parseInt(event.target.dataset.index, 10)
    const record = this.filteredRecords[index]

    if (this.selectionTypeValue === "radio") {
      this.selectedItems = [record]
    } else {
      const existingIndex = this.selectedItems.findIndex(item =>
        JSON.stringify(item) === JSON.stringify(record)
      )

      if (existingIndex >= 0) {
        this.selectedItems.splice(existingIndex, 1)
      } else {
        this.selectedItems.push(record)
      }
    }

    this.render()
    this.dispatchSelectionChange()
  }

  isItemSelected(record) {
    return this.selectedItems.some(item =>
      JSON.stringify(item) === JSON.stringify(record)
    )
  }

  dispatchSelectionChange() {
    this.dispatch("selectionChange", {
      detail: { selectedItems: this.selectedItems }
    })
  }

  // Get selected items (for external access)
  getSelectedItems() {
    return this.selectedItems
  }

  // Clear selections
  clearSelections() {
    this.selectedItems = []
    this.render()
  }

  // Button click
  buttonClick(event) {
    const action = event.currentTarget.dataset.buttonAction
    const index = parseInt(event.currentTarget.dataset.index, 10)
    const record = this.filteredRecords[index]

    this.dispatch("buttonClick", {
      detail: { action, record, index }
    })
  }

  // Search/filter
  search(event) {
    const query = event.target.value.toLowerCase()

    if (!query) {
      this.filteredRecords = [...this.recordsValue]
    } else {
      this.filteredRecords = this.recordsValue.filter(record => {
        return this.displayColumns.some(col => {
          const colName = col.ColumnName || col
          const value = record[colName]
          return value && String(value).toLowerCase().includes(query)
        })
      })
    }

    this.currentPageValue = 0
    this.render()
  }

  // Refresh data
  refresh(records) {
    this.recordsValue = records
    this.currentPageValue = 0
  }

  // Update single record
  updateRecord(index, record) {
    this.recordsValue[index] = record
    this.filteredRecords = [...this.recordsValue]
    this.render()
  }

  // Export to Excel (using simple CSV for now)
  exportToExcel() {
    const headers = this.displayColumns.map(col => this.getColumnDisplay(col))
    const rows = this.filteredRecords.map(record => {
      return this.displayColumns.map(col => {
        const colName = col.ColumnName || col
        return this.formatValue(record[colName])
      })
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  // Set loading state
  setLoading(loading) {
    if (this.hasLoadingTarget) {
      if (loading) {
        this.loadingTarget.classList.remove("hidden")
      } else {
        this.loadingTarget.classList.add("hidden")
      }
    }
  }
}
