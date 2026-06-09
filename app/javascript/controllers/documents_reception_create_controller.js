import { Controller } from '@hotwired/stimulus'
import { Storage, SStore } from 'vendor/clavisco/core'
import { showToast } from 'vendor/clavisco/alerts'
import { showLoading, hideLoading } from 'vendor/clavisco/overlay'

// ── Constantes de dominio ──────────────────────────────────
const RETURN_URL = '/documents/receptions'

// CondicionImpuesto que habilitan TaxFactor
const TAX_FACTOR_CONDITIONS = new Set(['03', '05'])

// Mensajes que requieren DetalleMensaje
const DETAIL_REQUIRED_MESSAGES = new Set(['2', '3'])

// DocTypes.Factura
const DOC_TYPE_FACTURA = 1

// Debounce (ms) para el autocomplete de documento base
const AUTOCOMPLETE_DEBOUNCE = 260

export default class extends Controller {
  static values = { docId: Number }

  static targets = [
    // Acordeón recepción
    'receptAccordion', 'receptAccordionBody', 'receptAccordionIcon',
    'receptMensaje', 'receptCondicionImpuesto', 'receptTaxFactor', 'receptCodigoActividad', 'receptDetalleMensaje',
    'errorReceptMensaje', 'errorReceptTaxFactor', 'errorReceptCodigoActividad', 'errorReceptDetalleMensaje',
    // Tabs
    'tabsContainer',
    'tabBtnCabecera', 'tabBtnLineas', 'tabBtnOtrosCargos',
    'tabCabecera', 'tabLineas', 'tabOtrosCargos',
    // Cabecera
    'selectRefDocType', 'inputRefDocEntry', 'refDocAutocompleteList', 'loadingRefDoc',
    'checkCloseRefDoc',
    'inputCardCode', 'supplierAutocompleteList', 'errorCardCode',
    'inputDocDate', 'inputCardName', 'inputDocDueDate', 'inputNumAtCard',
    'inputTaxDate', 'inputDocCur', 'inputComments', 'commentsCharCount',
    'udfsContainer',
    'apInvoiceLinesBody',
    'totalsSubtotal', 'totalsOtrosCargos', 'totalsImpuestos', 'totalsDescuento', 'totalsTotal',
    'btnCreateDraft', 'btnCreateSap',
    // Líneas
    'xmlLinesBody', 'sapLinesBody',
    // Otros Cargos
    'otrosCargosBody',
    // Loading overlay
    'loadingOverlay', 'loadingMessage',
    // Modales
    'currencyMismatchModal', 'currencyMismatchXmlCode', 'currencyMismatchSelect', 'currencyMismatchSave',
    'toleranceModal', 'toleranceDocCurrency', 'toleranceSelect',
    'confirmRefreshModal',
    'successModal', 'successModalMessage',
    'warningModal', 'warningModalMessage',
    'errorModal', 'errorModalMessage',
    // Preview panel
    'previewBackdrop', 'previewPanel', 'previewBody',
    // Item selection panel
    'itemPanelBackdrop', 'itemPanel', 'itemPanelLineInfo',
    'itemSelectItem', 'itemSelectWarehouse', 'itemQuantity',
    'itemSelectAccount', 'itemSelectProject',
  ]

  // ── Estado interno ─────────────────────────────────────
  #docId            = null
  #companyId        = null
  #session          = null
  #shouldRecept     = false

  // Datos de catálogos
  #accountList      = []
  #taxCodeList      = []
  #itemSAPList      = []
  #warehouseList    = []
  #projectList      = []
  #supplierList     = []
  #docTypeList      = []
  #companyCurrencies= []
  #xmlToleranceAmounts = []
  #defaultTaxForXML = ''
  #dynamicUdfs      = []
  #sendReceptAndApInv = false

  // Datos del XML
  #xmlDoc           = null
  #xmlDocCopy       = null
  #xmlDoc2          = null   // cargos del XML
  #docCurrency      = ''
  #docTypeXML       = null
  #returnUrlType    = null

  // Estado del formulario Cabecera
  #cardCodeValue    = ''
  #selectedSupplierId = null
  #selectedDocEntry = null
  #closeRefDocument = false
  #supplierExtraDays= 0

  // Estado de líneas de factura
  #apInvoiceLines   = []     // líneas principales
  #otherChargeLines = []     // líneas de otros cargos
  #idItemTable      = 0
  #selectedXmlLine  = null   // línea XML actualmente seleccionada para agregar
  #errorOnCreate    = false

  // Preview doc (reception)
  #previewDocument  = null

  // Tolerancia — resolver promise externo
  #toleranceResolve = null
  #currencyResolve  = null

  // Debounce timer para autocomplete
  #refDocDebounceTimer = null

  // Mapeo de UDFs completado
  #mappedUdfs = []

  // ── connect ───────────────────────────────────────────
  connect() {
    this.#docId     = this.docIdValue
    this.#session   = Storage.get('Session') || {}
    const company   = SStore.get('CurrentCompany')

    if (company) {
      this.#companyId         = company.companyId
      this.#sendReceptAndApInv = !!company.SendReceptAndApInv
    }

    // Leer parámetros de query string
    const params = new URLSearchParams(window.location.search)
    this.#docTypeXML   = params.has('xmlDocType') ? Number(params.get('xmlDocType')) : null
    this.#returnUrlType= params.get('urlToReturnType')
    this.#shouldRecept = sessionStorage.getItem('shouldRecept') === 'true'

    if (this.#shouldRecept) {
      this.receptAccordionTarget.classList.remove('hidden')
    }

    this.#loadAll()
  }

  disconnect() {
    sessionStorage.removeItem('shouldRecept')
    if (this.#refDocDebounceTimer) clearTimeout(this.#refDocDebounceTimer)
  }

  // ── Carga inicial paralela ─────────────────────────────
  async #loadAll() {
    if (!this.#companyId) {
      this.#openWarning('No tiene una compañía seleccionada. Seleccione una antes de continuar.')
      return
    }
    if (this.#docTypeXML === null) {
      showToast('Tipo de documento XML no especificado', 'error')
      window.location.href = this.#getReturnUrl()
      return
    }

    this.#showLoading('Cargando información...')

    try {
      const [
        accountsRes, docXmlRes, docChargesRes, taxRes, itemsRes,
        companyRes, dimensionsRes, warehouseRes, projectsRes, currenciesRes
      ] = await Promise.all([
        this.#apiFetch('/api/Account/GetAccounts'),
        this.#apiFetch(`/api/Documents/GetDocAPInvoiceInfoXML?docId=${this.#docId}`),
        this.#apiFetch(`/api/Documents/GetDocAPInvoiceCharges?docId=${this.#docId}`),
        this.#apiFetch(`/api/Tax?CompanyId=${this.#companyId}`),
        this.#apiFetch('/api/Item/GetItems'),
        this.#apiFetch(`/api/companies/${this.#companyId}`),
        this.#apiFetch('/api/Companies/GetDimensionsAndCntrCost'),
        this.#apiFetch(`/api/Warehouse?CompanyId=${this.#companyId}`),
        this.#apiFetch('/api/Project'),
        this.#apiFetch(`/api/Companies/${this.#companyId}/currencies`),
      ])

      if (accountsRes?.Data?.length)     this.#accountList      = accountsRes.Data
      if (docXmlRes?.Data)               this.#xmlDoc           = docXmlRes.Data
      if (docChargesRes?.Data)           this.#xmlDoc2          = docChargesRes.Data
      if (taxRes?.Data?.length)          this.#taxCodeList      = taxRes.Data
      if (itemsRes?.Data?.length)        this.#itemSAPList      = itemsRes.Data
      if (companyRes?.Data) {
        this.#xmlToleranceAmounts = companyRes.Data.XmlToleranceAmounts ?? []
        this.#defaultTaxForXML    = companyRes.Data.DefaultTaxForXML    ?? ''
      }
      if (warehouseRes?.Data?.length)    this.#warehouseList    = warehouseRes.Data
      if (projectsRes?.Data?.length)     this.#projectList      = projectsRes.Data
      if (currenciesRes?.Data)           this.#companyCurrencies = currenciesRes.Data ?? []
    } catch (err) {
      this.#hideLoading()
      this.#openError(`Error al cargar datos: ${err.message}`)
      return
    }

    // Segunda carga (proveedores, UDFs, tipos de doc base)
    try {
      const [suppliersRes, udfsRes, docTypeBaseRes] = await Promise.all([
        this.#apiFetch('/api/BusinessPartners'),
        this.#apiFetch(`/api/Udf/GetConfiguredUdfs?companyId=${this.#companyId}&Category=true`),
        this.#apiFetch('/api/Documents/GetDocTypeBase'),
      ])

      if (suppliersRes?.Data)    this.#supplierList  = suppliersRes.Data
      if (udfsRes?.Data)         this.#dynamicUdfs   = udfsRes.Data
      if (docTypeBaseRes?.Data)  this.#docTypeList   = docTypeBaseRes.Data
    } catch (err) {
      showToast(`Advertencia al cargar catálogos: ${err.message}`, 'warning')
    }

    this.#hideLoading()
    await this.#validateAndApplyDocXML()
  }

  // ── Validación de moneda del XML ───────────────────────
  async #validateAndApplyDocXML() {
    if (!this.#xmlDoc) {
      this.#finishSetup()
      return
    }

    const xmlCur = this.#xmlDoc.DocCur
    const match  = this.#companyCurrencies.find(c => c.Code === xmlCur)

    if (match) {
      this.#applyXMLDocToState(xmlCur)
    } else {
      const result = await this.#openCurrencyMismatchModal(xmlCur)
      if (!result?.code) {
        showToast('Debe seleccionar una moneda para continuar', 'warning')
        return
      }
      if (result.save) {
        this.#apiFetch(`/api/Companies/${this.#companyId}/currency-map`, {
          method: 'POST',
          body: JSON.stringify({ XmlCurrencyCode: xmlCur, MappedCurrencyCode: result.code }),
        }).catch(() => {})
      }
      this.#applyXMLDocToState(result.code)
    }
  }

  #applyXMLDocToState(docCur) {
    const symbol = this.#companyCurrencies.find(c => c.Code === docCur)?.Symbol ?? docCur
    this.#xmlDoc.DocCur = docCur
    this.#docCurrency   = symbol

    this.#xmlDoc.DocReceptXMLLines.forEach(line => {
      line.DocCur    = symbol
      line.Available = line.Quantity
    })

    if (this.#xmlDoc2?.DocChargesXMLLines?.length) {
      this.#xmlDoc2.DocCur = docCur
      this.#xmlDoc2.DocChargesXMLLines.forEach(line => {
        line.DocCur    = symbol
        line.Available = line.Quantity
      })
    }

    this.#finishSetup()
  }

  #finishSetup() {
    this.#populateDropdowns()
    this.#renderDynamicUdfs()
    this.#prefillHeaderFromXML()
    this.#patchSupplierFromXML()
    this.#renderXmlLinesTable()
    this.#renderOtrosCargosTable()
    this.#loadReceptPreviewIfNeeded()
    this.tabsContainerTarget.classList.remove('hidden')
  }

  // ── Poblar dropdowns ───────────────────────────────────
  #populateDropdowns() {
    // RefDocType
    const refSelect = this.selectRefDocTypeTarget
    this.#docTypeList.forEach(d => {
      const opt = document.createElement('option')
      opt.value       = d.DocType
      opt.textContent = d.DocTypeShow
      refSelect.appendChild(opt)
    })

    // Item selector (modal)
    const itemSel = this.itemSelectItemTarget
    this.#itemSAPList.forEach(item => {
      const opt = document.createElement('option')
      opt.value       = item.ItemCode
      opt.textContent = item.FullName || `${item.ItemCode} - ${item.ItemName}`
      itemSel.appendChild(opt)
    })

    // Warehouse selector (modal)
    const whSel = this.itemSelectWarehouseTarget
    this.#warehouseList.forEach(wh => {
      const opt = document.createElement('option')
      opt.value       = wh.WhCode
      opt.textContent = `${wh.WhCode} — ${wh.WhName}`
      whSel.appendChild(opt)
    })

    // Account selector (modal)
    const accSel = this.itemSelectAccountTarget
    this.#accountList.forEach(acc => {
      const opt = document.createElement('option')
      opt.value       = acc.AcctCode
      opt.textContent = `${acc.FormatCode} - ${acc.AcctName}`
      accSel.appendChild(opt)
    })

    // Project selector (modal)
    const prjSel = this.itemSelectProjectTarget
    this.#projectList.forEach(prj => {
      const opt = document.createElement('option')
      opt.value       = prj.Code
      opt.textContent = `${prj.Code} - ${prj.Name}`
      prjSel.appendChild(opt)
    })
  }

  // ── UDFs dinámicos ─────────────────────────────────────
  #renderDynamicUdfs() {
    if (!this.#dynamicUdfs.length) return
    const container = this.udfsContainerTarget

    this.#dynamicUdfs.forEach(udf => {
      const wrapper = document.createElement('div')

      if (udf.Values) {
        // Select
        const mapped = JSON.parse(udf.Values)
        wrapper.innerHTML = `
          <label class="block text-xs font-medium text-gray-600 mb-1">${udf.Description}${udf.IsRequired ? ' <span class="text-red-500">*</span>' : ''}</label>
          <select name="udf_${udf.Name}" data-udf-name="${udf.Name}"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">-- Seleccione --</option>
            ${mapped.map(v => `<option value="${v.Value}">${v.Description}</option>`).join('')}
          </select>`
      } else {
        // Text input
        wrapper.innerHTML = `
          <label class="block text-xs font-medium text-gray-600 mb-1">${udf.Description}${udf.IsRequired ? ' <span class="text-red-500">*</span>' : ''}</label>
          <input type="text" name="udf_${udf.Name}" data-udf-name="${udf.Name}"
                 class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">`
      }
      container.appendChild(wrapper)
    })
  }

  // ── Pre-relleno del formulario desde xmlDoc ────────────
  #prefillHeaderFromXML() {
    if (!this.#xmlDoc) return

    const taxDate = this.#xmlDoc.TaxDate ? this.#xmlDoc.TaxDate.split('T')[0] : ''

    this.inputDocDateTarget.value    = taxDate
    this.inputTaxDateTarget.value    = taxDate
    this.inputCardNameTarget.value   = this.#xmlDoc.CardName   ?? ''
    this.inputNumAtCardTarget.value  = this.#xmlDoc.NumAtCard  ?? ''
    this.inputCommentsTarget.value   = this.#xmlDoc.Comments   ?? ''
    this.inputDocCurTarget.value     = this.#xmlDoc.DocCur     ?? ''
    this.commentsCharCountTarget.textContent = (this.#xmlDoc.Comments ?? '').length

    // POCL24 en OthersRecepts → RefDocType = Orden de Compra
    const pocl24 = this.#xmlDoc.OthersRecepts?.find(r => r.Codigo === 'POCL24')
    if (pocl24?.Valor) {
      this.inputRefDocEntryTarget.value = pocl24.Valor
    }

    // DocDueDate inicial = TaxDate (sin ExtraDays todavía)
    this.inputDocDueDateTarget.value = taxDate
  }

  #patchSupplierFromXML() {
    if (!this.#xmlDoc) return
    const sup = this.#supplierList.find(s => s.LicTradNum?.includes(this.#xmlDoc.LicTradNum))
    if (sup) {
      this.inputCardCodeTarget.value = sup.FullName
      this.#cardCodeValue            = sup.FullName
      this.#selectedSupplierId       = sup.CardCode
      this.#supplierExtraDays        = sup.ExtraDays ?? 0
      this.#updateDocDueDate()
      this.#updateHeaderFormValidity()
    } else if (this.#xmlDoc.LicTradNum) {
      this.#openWarning(`El proveedor ${this.#xmlDoc.CardName} con la cédula ${this.#xmlDoc.LicTradNum} no existe en SAP`)
    }
  }

  // ── Acordeón de recepción ──────────────────────────────
  toggleReceptAccordion() {
    const body = this.receptAccordionBodyTarget
    const icon = this.receptAccordionIconTarget
    body.classList.toggle('hidden')
    icon.style.transform = body.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'
  }

  // ── Carga datos de previsualización para el acordeón ──
  async #loadReceptPreviewIfNeeded() {
    if (!this.#shouldRecept) return
    try {
      const data = await this.#apiFetch(`/api/Documents/GetDocumentInfoPreview?documentId=${this.#docId}`)
      if (data?.Data) {
        this.#previewDocument = data.Data
        const r = data.Data.Reception
        if (r) {
          if (r.Mensaje)            this.receptMensajeTarget.value = String(r.Mensaje)
          if (r.CondicionImpuesto)  this.receptCondicionImpuestoTarget.value = r.CondicionImpuesto
          if (r.TaxFactor)          this.receptTaxFactorTarget.value = r.TaxFactor
          if (r.CodigoActividad)    this.receptCodigoActividadTarget.value = r.CodigoActividad
          if (r.DetalleMensaje)     this.receptDetalleMensajeTarget.value = r.DetalleMensaje
        }
        // Aplicar lógica inicial de TaxFactor
        this.onReceptCondicionChange()
      }
    } catch (_err) {
      // Error no crítico
    }
  }

  // ── Eventos del acordeón de recepción ─────────────────
  onReceptCondicionChange() {
    const condicion = this.receptCondicionImpuestoTarget.value
    const taxInput  = this.receptTaxFactorTarget

    if (TAX_FACTOR_CONDITIONS.has(condicion)) {
      taxInput.disabled = false
      taxInput.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed')
    } else {
      taxInput.disabled = true
      taxInput.value    = ''
      taxInput.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed')
      this.errorReceptTaxFactorTarget.classList.add('hidden')
    }
  }

  onReceptMensajeChange() {
    const mensaje  = this.receptMensajeTarget.value
    const required = DETAIL_REQUIRED_MESSAGES.has(mensaje)
    const textarea = this.receptDetalleMensajeTarget

    if (required) {
      textarea.placeholder = 'Detalle requerido para esta respuesta'
    } else {
      textarea.placeholder  = 'Detalle del mensaje (opcional)'
      this.errorReceptDetalleMensajeTarget.classList.add('hidden')
    }
  }

  // ── Previsualización (acordeón) ────────────────────────
  async previewReceptDoc() {
    if (!this.#previewDocument) {
      this.#openWarning('No hay documento para previsualizar. Cargue un documento primero.')
      return
    }
    this.#fillPreviewPanel(this.#previewDocument)
    this.#openPreview()
  }

  #fillPreviewPanel(data) {
    const sections = []
    sections.push(`<div class="grid grid-cols-2 gap-3">`)
    sections.push(this.#previewField('Consecutivo', data.NumeroConsecutivo))
    sections.push(this.#previewField('Fecha Emisión', data.FechaEmision))
    sections.push(this.#previewField('Clave', data.Clave))
    sections.push(this.#previewField('Moneda', data.ResumenFactura?.CodigoMoneda))
    sections.push(this.#previewField('Total', data.ResumenFactura?.TotalComprobante))
    sections.push(`</div>`)
    this.previewBodyTarget.innerHTML = sections.join('')
  }

  #previewField(label, value) {
    return `<div><p class="text-xs text-gray-500">${label}</p><p class="text-sm font-medium text-gray-800">${value ?? '—'}</p></div>`
  }

  // ── Tabs ───────────────────────────────────────────────
  switchTab(event) {
    const tab = event.currentTarget.dataset.tab

    const allPanels = [this.tabCabeceraTarget, this.tabLineasTarget, this.tabOtrosCargosTarget]
    const allBtns   = [this.tabBtnCabeceraTarget, this.tabBtnLineasTarget, this.tabBtnOtrosCargosTarget]

    allPanels.forEach(p => p.classList.add('hidden'))
    allBtns.forEach(b => {
      b.classList.remove('text-blue-600', 'border-blue-600')
      b.classList.add('text-gray-500', 'border-transparent')
    })

    const panelMap = { cabecera: this.tabCabeceraTarget, lineas: this.tabLineasTarget, 'otros-cargos': this.tabOtrosCargosTarget }
    const btnMap   = { cabecera: this.tabBtnCabeceraTarget, lineas: this.tabBtnLineasTarget, 'otros-cargos': this.tabBtnOtrosCargosTarget }

    panelMap[tab].classList.remove('hidden')
    btnMap[tab].classList.remove('text-gray-500', 'border-transparent')
    btnMap[tab].classList.add('text-blue-600', 'border-blue-600')

    // Al cambiar a Líneas: bloquear CardCode y RefDocType/Entry si POCL24
    if (tab === 'lineas') {
      this.inputCardCodeTarget.disabled = true
    }
  }

  // ── Formulario Cabecera ────────────────────────────────
  onRefDocTypeChange() {
    const value = this.selectRefDocTypeTarget.value
    const entry = this.inputRefDocEntryTarget

    if (!value) {
      entry.value    = ''
      entry.disabled = true
      entry.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed')
      this.#selectedDocEntry = null
      this.checkCloseRefDocTarget.disabled = true
    } else {
      entry.disabled = false
      entry.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed')
    }
    this.refDocAutocompleteListTarget.classList.add('hidden')
  }

  onRefDocEntryInput() {
    clearTimeout(this.#refDocDebounceTimer)
    const value   = this.inputRefDocEntryTarget.value.trim()
    const docType = this.selectRefDocTypeTarget.value

    if (!value || !docType) {
      this.refDocAutocompleteListTarget.classList.add('hidden')
      return
    }

    this.#refDocDebounceTimer = setTimeout(async () => {
      this.loadingRefDocTarget.classList.remove('hidden')
      try {
        const data = await this.#apiFetch(`/api/Documents/sap?docType=${docType}&searchCriteria=${encodeURIComponent(value)}`)
        const docs = data?.Data ?? []
        this.#renderRefDocAutocomplete(docs)

        // Si hay exactamente 1 resultado → seleccionar automáticamente
        if (docs.length === 1) {
          this.#selectRefDoc(docs[0])
        }
      } catch (_) {
        this.refDocAutocompleteListTarget.classList.add('hidden')
      } finally {
        this.loadingRefDocTarget.classList.add('hidden')
      }
    }, AUTOCOMPLETE_DEBOUNCE)
  }

  #renderRefDocAutocomplete(docs) {
    const list = this.refDocAutocompleteListTarget
    list.innerHTML = ''

    if (!docs.length) {
      list.classList.add('hidden')
      return
    }

    docs.forEach(doc => {
      const item = document.createElement('div')
      item.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm'
      item.dataset.testid = `option-doc-${doc.DocNum}`
      item.textContent = `#${doc.DocNum} - ${doc.CardCode}, ${doc.CardName}`
      item.addEventListener('click', () => this.#selectRefDoc(doc))
      list.appendChild(item)
    })

    list.classList.remove('hidden')
  }

  #selectRefDoc(doc) {
    this.inputRefDocEntryTarget.value = `#${doc.DocNum} - ${doc.CardCode}, ${doc.CardName}`
    this.#selectedDocEntry             = doc.DocEntry
    this.refDocAutocompleteListTarget.classList.add('hidden')
    this.checkCloseRefDocTarget.disabled = false
  }

  onCardCodeInput() {
    const filterValue = this.inputCardCodeTarget.value.toLowerCase()
    const filtered    = this.#supplierList.filter(s =>
      s.CardCode?.toLowerCase().includes(filterValue) ||
      s.CardName?.toLowerCase().includes(filterValue)
    )
    this.#renderSupplierAutocomplete(filtered)
  }

  #renderSupplierAutocomplete(suppliers) {
    const list = this.supplierAutocompleteListTarget
    list.innerHTML = ''

    if (!suppliers.length) {
      list.classList.add('hidden')
      return
    }

    suppliers.slice(0, 20).forEach(sup => {
      const item = document.createElement('div')
      item.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm'
      item.dataset.testid = `option-${sup.CardCode}`
      item.textContent    = sup.FullName
      item.addEventListener('click', () => this.#selectSupplier(sup))
      list.appendChild(item)
    })

    list.classList.remove('hidden')
  }

  #selectSupplier(sup) {
    this.inputCardCodeTarget.value = sup.FullName
    this.#cardCodeValue            = sup.FullName
    this.#selectedSupplierId       = sup.CardCode
    this.#supplierExtraDays        = sup.ExtraDays ?? 0
    this.supplierAutocompleteListTarget.classList.add('hidden')
    this.errorCardCodeTarget.classList.add('hidden')
    this.#updateDocDueDate()
    this.#updateHeaderFormValidity()
  }

  onTaxDateChange() {
    this.#updateDocDueDate()
  }

  #updateDocDueDate() {
    const taxDateVal = this.inputTaxDateTarget.value
    if (!taxDateVal) return
    const taxDate = new Date(taxDateVal)
    taxDate.setDate(taxDate.getDate() + this.#supplierExtraDays)
    this.inputDocDueDateTarget.value = taxDate.toISOString().split('T')[0]
  }

  setToday(event) {
    const field  = event.currentTarget.dataset.field
    const target = this[`${field}Target`]
    if (target) {
      target.value = new Date().toISOString().split('T')[0]
      if (field === 'inputTaxDate') this.#updateDocDueDate()
    }
  }

  onCommentsInput() {
    this.commentsCharCountTarget.textContent = this.inputCommentsTarget.value.length
  }

  // ── Validez del formulario Cabecera ───────────────────
  #updateHeaderFormValidity() {
    const valid = !!this.#selectedSupplierId

    this.btnCreateDraftTarget.disabled = !valid
    this.btnCreateSapTarget.disabled   = !valid

    if (valid) {
      this.tabBtnLineasTarget.classList.remove('hidden')
      if (this.#xmlDoc2?.DocChargesXMLLines?.length) {
        this.tabBtnOtrosCargosTarget.classList.remove('hidden')
      }
    } else {
      this.tabBtnLineasTarget.classList.add('hidden')
      this.tabBtnOtrosCargosTarget.classList.add('hidden')
    }
  }

  // ── Botón Refrescar ────────────────────────────────────
  refreshData() {
    this.confirmRefreshModalTarget.classList.remove('hidden')
  }

  closeConfirmRefresh() {
    this.confirmRefreshModalTarget.classList.add('hidden')
  }

  confirmRefresh() {
    window.location.reload()
  }

  // ── Tabla XML de líneas ────────────────────────────────
  #renderXmlLinesTable() {
    if (!this.#xmlDoc?.DocReceptXMLLines?.length) return
    const tbody = this.xmlLinesBodyTarget
    tbody.innerHTML = ''

    this.#xmlDoc.DocReceptXMLLines.forEach(line => {
      const tr = document.createElement('tr')
      tr.className           = 'border-b border-gray-100'
      tr.dataset.rowId       = line.RowId
      const available        = line.Available ?? line.Quantity
      const isAdded          = available <= 0

      tr.innerHTML = `
        <td class="px-3 py-2 text-xs text-gray-700">${line.Code}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.Detail}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${line.Quantity}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.UnitPrice, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.Discount, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${line.ImpTarifa ?? 0}%</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.TotalLine, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right ${isAdded ? 'text-green-600 font-semibold' : 'text-gray-700'}">${available}</td>
        <td class="px-3 py-2 text-center">
          <button type="button"
                  ${isAdded ? 'disabled' : ''}
                  data-action="click->documents-reception-create#openItemSelection"
                  data-row-id="${line.RowId}"
                  data-tooltip="Agregar"
                  class="p-1.5 ${isAdded ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'} rounded transition-colors">
            <span class="material-icons text-base">add_circle_outline</span>
          </button>
        </td>`
      tbody.appendChild(tr)
    })
  }

  // ── Tabla Otros Cargos ─────────────────────────────────
  #renderOtrosCargosTable() {
    if (!this.#xmlDoc2?.DocChargesXMLLines?.length) return
    const tbody = this.otrosCargosBodyTarget
    tbody.innerHTML = ''

    this.#xmlDoc2.DocChargesXMLLines.forEach(line => {
      const tr = document.createElement('tr')
      tr.className     = 'border-b border-gray-100'
      tr.dataset.rowId = line.RowId
      const available  = line.Available ?? line.Quantity

      tr.innerHTML = `
        <td class="px-3 py-2 text-xs text-gray-700">${line.Code ?? ''}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.Detail ?? ''}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${line.Quantity}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.UnitPrice, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${available}</td>
        <td class="px-3 py-2 text-center">
          <button type="button"
                  data-action="click->documents-reception-create#openOtrosCargosSelection"
                  data-row-id="${line.RowId}"
                  data-tooltip="Agregar cargo"
                  class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors">
            <span class="material-icons text-base">add_circle_outline</span>
          </button>
        </td>`
      tbody.appendChild(tr)
    })
  }

  // ── Panel lateral de selección de ítem ────────────────
  openItemSelection(event) {
    const rowId = Number(event.currentTarget.dataset.rowId)
    const line  = this.#xmlDoc.DocReceptXMLLines.find(l => l.RowId === rowId)
    if (!line || line.Available <= 0) {
      showToast('Esta línea ya está agregada', 'warning')
      return
    }
    this.#selectedXmlLine = line
    this.itemQuantityTarget.value = line.Available
    this.itemQuantityTarget.max   = line.Available

    // Mostrar info de la línea XML en el panel
    this.itemPanelLineInfoTarget.innerHTML =
      `<span class="font-semibold">${line.Code}</span> — ${line.Detail}` +
      `<span class="ml-3 text-blue-600 font-medium">Disponible: ${line.Available}</span>`

    this.#openItemPanel()
  }

  cancelItemSelection() {
    this.#selectedXmlLine = null
    this.#closeItemPanel()
  }

  #openItemPanel() {
    this.itemPanelBackdropTarget.classList.remove('hidden')
    this.itemPanelTarget.classList.remove('translate-x-full')
    document.body.style.overflow = 'hidden'
  }

  #closeItemPanel() {
    this.itemPanelTarget.classList.add('translate-x-full')
    this.itemPanelBackdropTarget.classList.add('hidden')
    document.body.style.overflow = ''
  }

  confirmItemSelection() {
    const line      = this.#selectedXmlLine
    if (!line) return

    const itemCode  = this.itemSelectItemTarget.value
    const whsCode   = this.itemSelectWarehouseTarget.value
    const quantity  = Number(this.itemQuantityTarget.value)
    const accCode   = this.itemSelectAccountTarget.value
    const prjCode   = this.itemSelectProjectTarget.value

    if (!itemCode || !whsCode || !quantity) {
      showToast('Complete artículo, almacén y cantidad', 'warning')
      return
    }

    const itemSAP  = this.#itemSAPList.find(i => i.ItemCode === itemCode)
    const acc      = this.#accountList.find(a => a.AcctCode === accCode)
    const prj      = this.#projectList.find(p => p.Code === prjCode)
    const taxEntry = this.#resolveTaxForLine(line)

    const apLine = {
      RowId:          line.RowId,
      TableId:        this.#idItemTable++,
      ItemCode:       itemCode,
      InvtItem:       itemSAP?.InvntItem ?? '',
      SapAccountCode: acc?.AcctCode      ?? '',
      SapAccountName: acc ? `${acc.FormatCode}-${acc.AcctName}` : '',
      ItemCodeXML:    line.Code,
      ItemNameXML:    line.Detail,
      ItemNameEdited: line.Detail,
      LineCurr:       line.DocCur,
      Quantity:       quantity,
      UnitPrice:      line.UnitPrice,
      Disc:           (line.Discount / line.Quantity) * quantity,
      TaxCode:        taxEntry.TaxCode,
      TaxRate:        String(line.ImpTarifa ?? 0),
      TaxAmount:      0,
      LineTotal:      0,
      WhsCode:        whsCode,
      Dimension1: '', Dimension2: '', Dimension3: '', Dimension4: '', Dimension5: '',
      SelectedDimensions: '',
      IsSelected:     false,
      XmlUndMed:      line.XmlUndMed      ?? '',
      XmlUndMedComercial: line.XmlUndMedComercial ?? '',
      XmlCodType:     line.XmlCodType     ?? '',
      ProjectCode:    prjCode,
      ProjectName:    prj ? `${prj.Code}-${prj.Name}` : '',
    }

    // Calcular TaxAmount y LineTotal
    apLine.TaxAmount = ((apLine.UnitPrice * quantity) - apLine.Disc) * (Number(apLine.TaxRate) / 100)
    apLine.LineTotal = ((apLine.UnitPrice * quantity) - apLine.Disc) + apLine.TaxAmount

    this.#apInvoiceLines.push(apLine)

    // Actualizar disponible en tabla XML
    line.Available = (line.Available - quantity)

    this.#renderXmlLinesTable()
    this.#renderSapLinesTable()
    this.#renderApInvoiceLinesHeader()
    this.#calculateTotals()
    this.#closeItemPanel()
    this.#selectedXmlLine = null
  }

  #resolveTaxForLine(xmlLine) {
    const impTarifa = xmlLine.ImpTarifa ?? 0
    const match     = this.#taxCodeList.find(t =>
      Number(t.TaxRate ?? t.Percent ?? 0) === Number(impTarifa)
    )
    return match ? { TaxCode: match.TaxCode } : { TaxCode: this.#defaultTaxForXML }
  }

  openOtrosCargosSelection(event) {
    // Implementación básica — agrega como cargo adicional
    const rowId = Number(event.currentTarget.dataset.rowId)
    const line  = this.#xmlDoc2?.DocChargesXMLLines?.find(l => l.RowId === rowId)
    if (!line) return
    showToast('Funcionalidad de otros cargos en desarrollo', 'info')
  }

  // ── Tabla SAP de líneas ────────────────────────────────
  #renderSapLinesTable() {
    const tbody = this.sapLinesBodyTarget
    tbody.innerHTML = ''

    if (!this.#apInvoiceLines.length) {
      tbody.innerHTML = '<tr><td colspan="12" class="px-3 py-4 text-center text-xs text-gray-400">Sin líneas</td></tr>'
      return
    }

    this.#apInvoiceLines.forEach((line, idx) => {
      const tr = document.createElement('tr')
      tr.className = 'border-b border-gray-100'

      // Dropdown impuesto
      const taxOptions = this.#taxCodeList
        .map(t => `<option value="${t.TaxCode}" ${t.TaxCode === line.TaxCode ? 'selected' : ''}>${t.TaxCode}</option>`)
        .join('')

      // Dropdown cuenta
      const accOptions = `<option value="">—</option>` + this.#accountList
        .map(a => `<option value="${a.AcctCode}" ${a.AcctCode === line.SapAccountCode ? 'selected' : ''}>${a.FormatCode}-${a.AcctName}</option>`)
        .join('')

      // Dropdown proyecto
      const prjOptions = `<option value="">—</option>` + this.#projectList
        .map(p => `<option value="${p.Code}" ${p.Code === line.ProjectCode ? 'selected' : ''}>${p.Code}-${p.Name}</option>`)
        .join('')

      tr.innerHTML = `
        <td class="px-3 py-2 text-xs text-gray-700">${line.ItemCode}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.ItemCodeXML}</td>
        <td class="px-3 py-2 text-xs">
          <input type="text" value="${line.ItemNameEdited}"
                 data-idx="${idx}" data-field="ItemNameEdited"
                 data-action="change->documents-reception-create#onSapLineFieldChange"
                 class="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
        </td>
        <td class="px-3 py-2 text-xs">
          <select data-idx="${idx}" data-field="SapAccountCode"
                  data-action="change->documents-reception-create#onSapLineSelectChange"
                  class="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            ${accOptions}
          </select>
        </td>
        <td class="px-3 py-2 text-xs">
          <select data-idx="${idx}" data-field="ProjectCode"
                  data-action="change->documents-reception-create#onSapLineSelectChange"
                  class="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            ${prjOptions}
          </select>
        </td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${line.Quantity}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.WhsCode}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.UnitPrice, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.Disc, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs">
          <select data-idx="${idx}" data-field="TaxCode"
                  data-action="change->documents-reception-create#onSapLineSelectChange"
                  class="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            ${taxOptions}
          </select>
        </td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.LineTotal, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-center">
          <button type="button"
                  data-action="click->documents-reception-create#removeSapLine"
                  data-idx="${idx}"
                  data-tooltip="Eliminar"
                  class="p-1.5 text-red-600 rounded hover:bg-red-50 transition-colors">
            <span class="material-icons text-base">delete</span>
          </button>
        </td>`
      tbody.appendChild(tr)
    })
  }

  onSapLineFieldChange(event) {
    const idx   = Number(event.target.dataset.idx)
    const field = event.target.dataset.field
    this.#apInvoiceLines[idx][field] = event.target.value
    this.#renderApInvoiceLinesHeader()
  }

  onSapLineSelectChange(event) {
    const idx   = Number(event.target.dataset.idx)
    const field = event.target.dataset.field
    this.#apInvoiceLines[idx][field] = event.target.value

    if (field === 'SapAccountCode') {
      const acc = this.#accountList.find(a => a.AcctCode === event.target.value)
      this.#apInvoiceLines[idx].SapAccountName = acc ? `${acc.FormatCode}-${acc.AcctName}` : ''
    }
    if (field === 'TaxCode') {
      const tax = this.#taxCodeList.find(t => t.TaxCode === event.target.value)
      if (tax) {
        const line = this.#apInvoiceLines[idx]
        line.TaxRate   = String(tax.TaxRate ?? 0)
        line.TaxAmount = ((line.UnitPrice * line.Quantity) - line.Disc) * (Number(line.TaxRate) / 100)
        line.LineTotal = ((line.UnitPrice * line.Quantity) - line.Disc) + line.TaxAmount
      }
    }
    this.#calculateTotals()
    this.#renderApInvoiceLinesHeader()
  }

  removeSapLine(event) {
    const idx  = Number(event.currentTarget.dataset.idx)
    const line = this.#apInvoiceLines[idx]

    // Restituir disponible en la tabla XML
    const xmlLine = this.#xmlDoc?.DocReceptXMLLines?.find(l => l.RowId === line.RowId)
    if (xmlLine) xmlLine.Available = (xmlLine.Available + line.Quantity)

    this.#apInvoiceLines.splice(idx, 1)
    this.#renderSapLinesTable()
    this.#renderXmlLinesTable()
    this.#renderApInvoiceLinesHeader()
    this.#calculateTotals()
  }

  // ── Tabla de líneas en Cabecera (read-only) ────────────
  #renderApInvoiceLinesHeader() {
    const tbody = this.apInvoiceLinesBodyTarget
    tbody.innerHTML = ''

    if (!this.#apInvoiceLines.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="px-3 py-4 text-center text-xs text-gray-400">Sin líneas agregadas</td></tr>'
      return
    }

    this.#apInvoiceLines.forEach(line => {
      const tr = document.createElement('tr')
      tr.className  = 'border-b border-gray-100'
      tr.innerHTML  = `
        <td class="px-3 py-2 text-xs text-gray-700">${line.ItemCode}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.ItemCodeXML}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.ItemNameEdited}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.SapAccountName}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.ProjectCode}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${line.Quantity}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.WhsCode}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.UnitPrice, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.Disc, this.#docCurrency)}</td>
        <td class="px-3 py-2 text-xs text-gray-700">${line.TaxCode}</td>
        <td class="px-3 py-2 text-xs text-right text-gray-700">${this.#fmtMoney(line.LineTotal, this.#docCurrency)}</td>`
      tbody.appendChild(tr)
    })
  }

  // ── Totales ────────────────────────────────────────────
  #calculateTotals() {
    let subTotal = 0, descuento = 0, impuestos = 0, total = 0, otrosCargos = 0

    this.#apInvoiceLines.forEach(line => {
      subTotal  += line.UnitPrice * line.Quantity
      descuento += line.Disc
      impuestos += line.TaxAmount
    })

    this.#otherChargeLines.forEach(line => { otrosCargos += line.LineTotal ?? 0 })

    total = (subTotal - descuento) + impuestos + otrosCargos

    this.totalsSubtotalTarget.textContent    = this.#fmtMoney(subTotal,    this.#docCurrency)
    this.totalsImpuestosTarget.textContent   = this.#fmtMoney(impuestos,   this.#docCurrency)
    this.totalsDescuentoTarget.textContent   = this.#fmtMoney(descuento,   this.#docCurrency)
    this.totalsOtrosCargosTarget.textContent = this.#fmtMoney(otrosCargos, this.#docCurrency)
    this.totalsTotalTarget.textContent       = this.#fmtMoney(total,        this.#docCurrency)

    this.#currentTotal      = total
    this.#currentSubTotal   = subTotal
    this.#currentDescuento  = descuento
    this.#currentImpuestos  = impuestos
    this.#currentOtrosCargos= otrosCargos
  }

  #currentTotal       = 0
  #currentSubTotal    = 0
  #currentDescuento   = 0
  #currentImpuestos   = 0
  #currentOtrosCargos = 0

  // ── Validación de UDFs ─────────────────────────────────
  #validateUdfs() {
    let valid = true
    this.#mappedUdfs = []

    this.#dynamicUdfs.forEach(udf => {
      const el  = this.udfsContainerTarget.querySelector(`[data-udf-name="${udf.Name}"]`)
      const val = el?.value ?? ''

      if (!val && udf.IsRequired) {
        showToast('Faltan datos requeridos en UDFs', 'warning')
        valid = false
      }

      this.#mappedUdfs.push({ Name: udf.Name, Value: val })
    })

    return valid
  }

  // ── Validación tolerancia ──────────────────────────────
  async #totalIsValid() {
    if (!this.#xmlDoc?.TotalFactura) return true

    const docCur   = this.#xmlDoc.DocCur ?? ''
    const tolerance= this.#xmlToleranceAmounts.find(t => t.CurrencyCode === docCur)

    if (tolerance !== undefined || !this.#xmlToleranceAmounts.length) {
      return this.#validateTotalRange(tolerance?.Tolerance ?? 0, docCur)
    }

    // Moneda sin tolerancia → abrir modal
    const selected = await this.#openToleranceModal(docCur)
    if (!selected) return false
    return this.#validateTotalRange(selected.Tolerance, docCur)
  }

  #validateTotalRange(tolerance, docCur) {
    const xmlTotal = this.#xmlDoc.TotalFactura
    const high     = xmlTotal + tolerance
    const low      = Math.max(0, xmlTotal - tolerance)

    if (this.#currentTotal >= low && this.#currentTotal <= high) return true

    showToast(
      `El monto de la factura (${this.#fmtMoney(this.#currentTotal, docCur)}) no coincide con el XML (${this.#fmtMoney(xmlTotal, docCur)}). Tolerancia: ${tolerance}`,
      'warning'
    )
    return false
  }

  // ── Crear factura ──────────────────────────────────────
  async createDraft()  { await this.#doCreate(true)  }
  async createInSap()  { await this.#doCreate(false) }

  async #doCreate(isDraft) {
    if (!this.#selectedSupplierId) {
      showToast('El formulario contiene errores: proveedor requerido', 'warning')
      return
    }

    if (this.#docTypeXML !== DOC_TYPE_FACTURA) {
      showToast('Solo se pueden crear facturas desde este módulo', 'warning')
      return
    }

    if (!this.#validateUdfs()) return

    const totalValid = await this.#totalIsValid()
    if (!totalValid) return

    const receptAndCreate = this.#sendReceptAndApInv && this.#shouldRecept
    if (receptAndCreate && !this.#errorOnCreate) {
      if (!this.#validateReceptForm()) {
        this.#openWarning('Verificar la información de la recepción, existen datos pendientes')
        return
      }
    }

    this.#showLoading('Creando factura, espere por favor...')

    try {
      const payload = this.#buildPayload(isDraft)

      if (receptAndCreate && !this.#errorOnCreate) {
        await this.#submitWithRecept(payload)
      } else {
        await this.#submitAPInvoiceOnly(payload, isDraft)
      }
    } catch (err) {
      this.#hideLoading()
      this.#openError(err.message || 'Error al crear la factura')
    }
  }

  async #submitAPInvoiceOnly(payload, isDraft) {
    const response = await this.#apiFetch('/api/documents/ap-invoices', {
      method: 'POST',
      body:   JSON.stringify(payload),
    })
    this.#hideLoading()

    if (response?.Data) {
      const msg = response.Message
        ? response.Message
        : `Documento número ${response.Data.DocNum} creado correctamente`
      this.#showSuccess(msg)
    } else {
      this.#openWarning(`Ocurrió un error: ${response?.Message ?? 'Error desconocido'}`)
    }
  }

  async #submitWithRecept(payload) {
    // Convertir payload a CreateReceptAndApInv
    const bandejaReceptor  = this.#previewDocument?.Reception?.BandejaReceptor ?? ''
    const feToken          = JSON.parse(sessionStorage.getItem('currentFEUser') || '{}')?.access_token ?? ''
    const userId           = this.#session.UserId ?? ''

    const receptAndApInvPayload = {
      APInvoice: {
        ...payload.APInvoice,
        U_APEmail_FE: bandejaReceptor,
      },
      CompanyId: payload.CompanyId,
      UpdateConsecutivoDoc: {
        docId:  this.#docId,
        feToken,
        docnum: 0,
      },
      Reception: {
        Recepcion: this.#buildReception(userId),
        editInfo:  false,
      },
    }

    const response = await this.#apiFetch('/api/documents/ap-invoices-with-recept', {
      method: 'POST',
      body:   JSON.stringify(receptAndApInvPayload),
    })
    this.#hideLoading()

    if (!response?.Data) {
      this.#errorOnCreate = true
      showToast(`Error: ${response?.Message ?? 'Error desconocido'}`, 'error')
      return
    }
    if (!response.Data.Reception) {
      showToast(`Error: ${response?.Message}`, 'error')
      return
    }
    if (!response.Data.ApInvoiceResponse) {
      this.#errorOnCreate = true
      showToast(`Recepción creada #${response.Data.Reception.AcceptId} pero error en factura: ${response.Message}`, 'warning')
      return
    }

    const msg = response.Message
      ? response.Message
      : `Documentos creados: recepción #${response.Data.Reception.AcceptId}, factura #${response.Data.ApInvoiceResponse.DocNum}`
    this.#showSuccess(msg)
  }

  #buildPayload(isDraft) {
    const cardCode = this.inputCardCodeTarget.value.split(' - ')[0].trim()

    const apInvoice = {
      CardCode:    cardCode,
      CardName:    this.inputCardNameTarget.value,
      DocCur:      this.inputDocCurTarget.value,
      NumAtCard:   this.inputNumAtCardTarget.value,
      DocDate:     this.inputDocDateTarget.value    || null,
      DocDueDate:  this.inputDocDueDateTarget.value || null,
      TaxDate:     this.inputTaxDateTarget.value    || null,
      Comments:    this.inputCommentsTarget.value,
      RefDocType:  Number(this.selectRefDocTypeTarget.value) || 0,
      DocBaseList: this.#selectedDocEntry ? [this.#selectedDocEntry] : [],
      APInvoiceLines: this.#apInvoiceLines,
      TotalFactura: 0,
      SupplierGetModel: '',
      LicTradNum:  '',
      U_APEmail_FE: '',
      MappedUdfs:  this.#mappedUdfs,
      DocumentAdditionalExpenses: this.#otherChargeLines,
      DocObjectCode: isDraft ? 'oPurchaseInvoices' : '',
      DocumentReferences: this.#selectedDocEntry ? [{
        RefObjType: Number(this.selectRefDocTypeTarget.value),
        RefDocEntr: this.#selectedDocEntry,
      }] : undefined,
      CloseRefDocument: !isDraft && this.#closeRefDocument,
    }

    const feToken = JSON.parse(sessionStorage.getItem('currentFEUser') || '{}')?.access_token ?? ''

    return {
      APInvoice: apInvoice,
      CompanyId: parseInt(this.#companyId),
      UpdateConsecutivoDoc: {
        docId:  this.#docId,
        feToken,
        docnum: 0,
      },
    }
  }

  #buildReception(userId) {
    return {
      Id:               this.#docId,
      Mensaje:          parseInt(this.receptMensajeTarget.value) || 0,
      DetalleMensaje:   this.receptDetalleMensajeTarget.value,
      Sucursal:         1,
      Terminal:         1,
      CompanyId:        parseInt(this.#companyId),
      CondicionImpuesto:this.receptCondicionImpuestoTarget.value,
      TaxFactor:        this.receptTaxFactorTarget.value,
      CodigoActividad:  this.receptCodigoActividadTarget.value,
      UserId:           userId,
    }
  }

  #validateReceptForm() {
    if (!this.#shouldRecept) return true
    const msg    = this.receptMensajeTarget.value
    const codigo = this.receptCodigoActividadTarget.value
    return !!msg && codigo.length === 6
  }

  // ── Modal de moneda mismatch ───────────────────────────
  #openCurrencyMismatchModal(xmlCode) {
    return new Promise(resolve => {
      this.#currencyResolve = resolve
      this.currencyMismatchXmlCodeTarget.textContent = xmlCode

      const select = this.currencyMismatchSelectTarget
      select.innerHTML = '<option value="">-- Seleccione --</option>'
      this.#companyCurrencies.forEach(c => {
        const opt       = document.createElement('option')
        opt.value       = c.Code
        opt.textContent = `${c.Code} — ${c.Name}`
        select.appendChild(opt)
      })

      this.currencyMismatchModalTarget.classList.remove('hidden')
    })
  }

  confirmCurrencyMismatch() {
    const code = this.currencyMismatchSelectTarget.value
    const save = this.currencyMismatchSaveTarget.checked
    this.currencyMismatchModalTarget.classList.add('hidden')
    this.#currencyResolve?.({ code, save })
    this.#currencyResolve = null
  }

  cancelCurrencyMismatch() {
    this.currencyMismatchModalTarget.classList.add('hidden')
    this.#currencyResolve?.({ code: null, save: false })
    this.#currencyResolve = null
  }

  // ── Modal de tolerancia ────────────────────────────────
  #openToleranceModal(docCur) {
    return new Promise(resolve => {
      this.#toleranceResolve = resolve
      this.toleranceDocCurrencyTarget.textContent = docCur

      const select = this.toleranceSelectTarget
      select.innerHTML = '<option value="">-- Seleccione --</option>'
      this.#xmlToleranceAmounts.forEach((t, i) => {
        const opt       = document.createElement('option')
        opt.value       = i
        opt.textContent = `${t.CurrencyCode} — ${t.Tolerance}`
        select.appendChild(opt)
      })

      this.toleranceModalTarget.classList.remove('hidden')
    })
  }

  confirmTolerance() {
    const idx = this.toleranceSelectTarget.value
    this.toleranceModalTarget.classList.add('hidden')
    this.#toleranceResolve?.(idx !== '' ? this.#xmlToleranceAmounts[Number(idx)] : null)
    this.#toleranceResolve = null
  }

  cancelTolerance() {
    this.toleranceModalTarget.classList.add('hidden')
    this.#toleranceResolve?.(null)
    this.#toleranceResolve = null
  }

  // ── Modales de feedback ────────────────────────────────
  #showSuccess(message) {
    this.successModalMessageTarget.textContent = message
    this.successModalTarget.classList.remove('hidden')
  }

  closeSuccessModal() {
    this.successModalTarget.classList.add('hidden')
    window.location.href = this.#getReturnUrl()
  }

  #openWarning(message) {
    this.warningModalMessageTarget.textContent = message
    this.warningModalTarget.classList.remove('hidden')
  }

  closeWarningModal() {
    this.warningModalTarget.classList.add('hidden')
  }

  #openError(message) {
    this.errorModalMessageTarget.textContent = message
    this.errorModalTarget.classList.remove('hidden')
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden')
  }

  // ── Preview panel ──────────────────────────────────────
  #openPreview() {
    this.previewBackdropTarget.classList.remove('hidden')
    this.previewPanelTarget.classList.remove('translate-x-full')
    document.body.style.overflow = 'hidden'
  }

  closePreview() {
    this.previewPanelTarget.classList.add('translate-x-full')
    this.previewBackdropTarget.classList.add('hidden')
    document.body.style.overflow = ''
  }

  // ── Loading overlay ────────────────────────────────────
  #showLoading(message = 'Cargando...') {
    this.loadingMessageTarget.textContent = message
    this.loadingOverlayTarget.classList.remove('hidden')
  }

  #hideLoading() {
    this.loadingOverlayTarget.classList.add('hidden')
  }

  // ── URL de retorno ─────────────────────────────────────
  #getReturnUrl() {
    return this.#returnUrlType ? '/documents/gt/receptions' : RETURN_URL
  }

  // ── Formato de moneda ──────────────────────────────────
  #fmtMoney(value, currency = '') {
    if (value == null || value === '') return '—'
    const num = parseFloat(value)
    if (isNaN(num)) return String(value)
    const formatted = num.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return currency ? `${currency} ${formatted}` : formatted
  }

  // ── apiFetch — patrón estándar del proyecto ────────────
  async #apiFetch(url, options = {}) {
    const apiTarget = options.headers?.['API'] ?? 'ApiAppUrl'

    const token     = (Storage.get('Session') || {}).access_token
    const company   = SStore.get('CurrentCompany')
    const companyId = company?.companyId ?? this.#companyId

    const headers = {
      'Content-Type':             'application/json',
      'API':                      apiTarget,
      'X-Skip-Error-Interceptor': 'true',
      ...(token     ? { Authorization:   `Bearer ${token}`  } : {}),
      ...(companyId ? { 'Cl-Company-Id': String(companyId)  } : {}),
      ...(options.headers || {}),
    }

    const response = await fetch(url, { ...options, headers })

    const clMessage = response.headers.get('cl-message')
    const decoded   = clMessage ? (() => {
      try { return decodeURIComponent(clMessage) } catch { return clMessage }
    })() : null

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(decoded || text || `HTTP ${response.status}`)
    }

    const hasBody = response.status !== 204 &&
      response.headers.get('content-length') !== '0' &&
      response.headers.get('content-type')?.includes('application/json')

    if (!hasBody) return { Message: decoded || null }

    const json = await response.json()
    if (decoded && !json.Message) json.Message = decoded
    return json
  }
}
