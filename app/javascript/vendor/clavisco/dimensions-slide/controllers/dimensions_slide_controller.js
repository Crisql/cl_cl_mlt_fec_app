import BaseSlideController from "vendor/clavisco/base/controllers/base_slide_controller"
import { getAPIHeaders } from "lib/api_helpers"
import { TabulatorFull as Tabulator } from 'tabulator-tables'

export default class DimensionsSlideController extends BaseSlideController {
  static targets = [...BaseSlideController.targets, "table"]
  static values = { ...BaseSlideController.values, lineIndex: Number }

  connect() {
    super.connect()
    this._openListener = (e) => this.handleOpen(e.detail)
    window.addEventListener("dimensions-slide:open", this._openListener)
    this.tabulator = null
  }

  disconnect() {
    window.removeEventListener("dimensions-slide:open", this._openListener)
    if (this.tabulator) this.tabulator.destroy()
    super.disconnect()
  }

  async handleOpen(detail) {
    this.lineIndexValue = detail.lineIndex
    this.lineData = detail.lineData || {}
    
    try {
      const response = await fetch("/api/Dimension", {
        headers: getAPIHeaders({ section: "dimensiones" })
      })
      
      if (response.ok) {
        const data = await response.json()
        this.renderTable(data.Data || [])
        this.open()
      }
    } catch (error) {
      console.error("[dimensions-slide] Error:", error)
    }
  }

  renderTable(dimensions) {
    if (!this.hasTableTarget) return
    
    const tableData = dimensions.map(dim => ({
      DimCode: dim.DimCode,
      DimName: dim.DimName,
      DimDesc: dim.DimDesc,
      DistributionRule: this.lineData['CostingCode' + (dim.DimCode === 1 ? '' : dim.DimCode)] || null,
      DistributionRulesList: dim.DistributionRulesList || []
    }))

    if (this.tabulator) this.tabulator.destroy()

    this.tabulator = new Tabulator(this.tableTarget, {
      data: tableData,
      layout: "fitColumns",
      height: "400px",
      columns: [
        { title: "Código", field: "DimCode", width: 100 },
        { title: "Nombre", field: "DimName", widthGrow: 1 },
        { title: "Descripción", field: "DimDesc", widthGrow: 2 },
        {
          title: "Regla de Distribución",
          field: "DistributionRule",
          widthGrow: 3,
          editor: "list",
          editorParams: (cell) => {
            const rules = cell.getRow().getData().DistributionRulesList
            const values = { "": "Ninguna" }
            rules.forEach(r => { values[r.OcrCode] = r.OcrCode + " - " + r.OcrName })
            return { values, clearable: true }
          }
        }
      ]
    })
  }

  save() {
    const result = {}
    this.tabulator.getData().forEach(row => {
      const field = row.DimCode === 1 ? 'CostingCode' : 'CostingCode' + row.DimCode
      result[field] = row.DistributionRule || null
    })
    
    window.dispatchEvent(new CustomEvent("dimensions-slide:saved", {
      detail: { lineIndex: this.lineIndexValue, dimensions: result }
    }))
    
    this.close()
  }
}
