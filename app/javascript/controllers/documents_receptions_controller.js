import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES, confirm } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';
import { showLoading, hideLoading } from 'vendor/clavisco/overlay';

/**
 * DocumentsReceptionsController — Búsqueda de documentos recibidos/aceptados.
 *
 * Replica la funcionalidad del componente Angular DocumentsAcceptanceComponent
 * (páginas/documents/receptions):
 *
 *   - Formulario de filtros: fechas, estado, mensaje, tipo doc, emisor, clave, cédula,
 *     consecutivo, bandeja, código de moneda
 *   - Checkbox "¿Fechas de Emisión de Documento?" (useXMLDates)
 *   - Tabla Tabulator server-side con columnas del documento recibido
 *   - Menú de opciones por fila: Ver PDF Recepción, Ver XML Resp Hacienda, Descargar XML Enviado,
 *     Enviar Aceptación, Previsualizar Aceptación, Obtenido del correo, Consultar Información,
 *     Enviar a SAP, Reprocesar, Detalle del Mensaje
 *   - Panel lateral "Recepcionar Documento"
 *   - Modales: info, confirmación, error
 *   - Botón "Más Información" (chart) y "Descarga Masiva"
 */

const DOC_STATUS = {
  1: { label: 'Aceptado',                   bg: '#e8f5ee', color: '#3a7d52' },  // verde
  2: { label: 'Procesando',                 bg: '#e8f0fe', color: '#1a56db' },  // azul
  3: { label: 'En Hacienda',                bg: '#e8f0fe', color: '#1a56db' },  // azul
  4: { label: 'Rechazado',                  bg: '#fdecea', color: '#c0392b' },  // rojo
  5: { label: 'Error',                      bg: '#fffbeb', color: '#b45309' },  // amarillo
  6: { label: 'Reprocesar',                 bg: '#e8f0fe', color: '#1a56db' },  // azul
  7: { label: 'Obtenido del Correo',        bg: '#f3f4f6', color: '#4b5563' },  // gris
  8: { label: 'Obtenido Correo Automático', bg: '#f3f4f6', color: '#4b5563' },  // gris
};

const MESSAGE_TYPES = { 1: 'Aceptado', 2: 'Aceptado Parcialmente', 3: 'Rechazado' };

const DOC_TYPES = {
  '01': 'FE', '02': 'ND', '03': 'NC', '04': 'TE',
  '08': 'FEC', '09': 'FEE', '10': 'REP',
};

export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,

    // Formulario de filtros
    'inputStartDate', 'inputEndDate',
    'checkUseXMLDates', 'labelDateType',
    'selectMessageType', 'selectStatus',
    'inputNombreEmisor', 'inputClave', 'inputCedula', 'inputConsecutivoEmisor',
    'selectDocType', 'selectBandeja', 'inputCodigoMoneda',

    // Toolbar
    'statusCounters', 'btnChart', 'btnBulkDownload', 'btnRecepcionar',

    // Panel recepcionar
    'receptPanel', 'receptBackdrop',
    'receptDocName', 'receptMensaje', 'receptCondicionImpuesto',
    'receptTaxFactor', 'receptCodigoActividad', 'receptDetalleMensaje',

    // Modal info simple (bandeja, detalle mensaje)
    'infoModal', 'infoTitle', 'infoBody',

    // Panel lateral Consultar Información (igual que documents-issued)
    'infoPanelBackdrop', 'infoPanel',
    'infoFechaEmision', 'infoDetalleMensaje', 'infoDetalleMensajeSection',
    'infoErrorSection', 'infoError',
    'infoErrorHaciendaSection', 'infoErrorHacienda',

    // Modal confirmación

    // Modal error
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ─────────────────────────────────────────────────────────

  #companyId = null;
  #permissions = [];
  #stepPos = 10;
  #startPos = 1;
  #quantities = {};
  #totalRecords = 0;
  #bandejas = [];
  #currencyCodes = [];
  #companyInfo = null;   // { DefaultTaxForXML, SendReceptAndApInv, UseFactProv }
  #activityCodes = [];
  #activeReceptDoc = null;
  #formChanged = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company     = SStore.get('CurrentCompany');
    const permissions = SStore.get('Permissions');

    this.#companyId   = company?.companyId ? parseInt(company.companyId) : null;
    this.#permissions = Array.isArray(permissions) ? permissions : [];

    // Inicializar fechas con hoy
    const today = this.#todayISO();
    this.inputStartDateTarget.value = today;
    this.inputEndDateTarget.value   = today;

    // Pre-llenar CodigoActividad del panel recepcionar desde la empresa
    if (company?.codigoActividad && this.hasReceptCodigoActividadTarget) {
      this.receptCodigoActividadTarget.value = company.codigoActividad;
    }

    // Mostrar botón descarga masiva si tiene permiso
    if (this.#hasPerm('F_CreateBulkDownloadOfDocuments')) {
      this.btnBulkDownloadTarget.classList.remove('hidden');
    }

    // Mostrar botón "Recepcionar" (carga de XML) si tiene permiso
    if (this.hasBtnRecepcionarTarget && this.#hasPerm('S_ReceptDocs')) {
      this.btnRecepcionarTarget.classList.remove('hidden');
    }

    // Escuchar cambios en el formulario para ocultar btnChart
    const formInputs = [
      this.inputStartDateTarget, this.inputEndDateTarget,
      this.checkUseXMLDatesTarget, this.selectMessageTypeTarget, this.selectStatusTarget,
      this.inputNombreEmisorTarget, this.inputClaveTarget, this.inputCedulaTarget,
      this.inputConsecutivoEmisorTarget, this.selectDocTypeTarget, this.inputCodigoMonedaTarget,
    ];
    formInputs.forEach(el => {
      el.addEventListener('input', () => this.#onFormChanged());
      el.addEventListener('change', () => this.#onFormChanged());
    });

    this.#loadInitialData();
    super.connect();
  }

  #onFormChanged() {
    this.#formChanged = true;
    this.btnChartTarget.classList.add('hidden');
  }

  // ── Configuración Tabulator ────────────────────────────────────────────────

  getTableConfig() {
    const baseConfig = super.getTableConfig();
    delete baseConfig.data; // Eliminar data estático para que Tabulator use AJAX desde el inicio

    return {
      ...baseConfig,
      height: '100%',
      maxHeight: undefined,
      movableRows: false,
      layout: 'fitColumns',
      placeholder: 'No se encontraron documentos para los filtros aplicados.',
      pagination: true,
      paginationMode: 'remote',
      paginationSize: 10,
      paginationSizeSelector: [5, 10, 15],
      paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
        const total = this.#totalRecords;
        if (!total) return '';
        const from = currentRow;
        const to   = Math.min(currentRow + _pageSize - 1, total);
        return `Mostrando ${from.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
      },
      ajaxURL: '/api/documents/receptions',
      ajaxRequestFunc: (_url, _config, params) => this.#tabulatorRequest(params),
      ajaxResponse:    (_url, _params, response) => response,
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: { headerSort: false },
      columns: this.getColumns(),
    };
  }

  getColumns() {
    return [
      {
        title: 'Fecha de Emisión',
        field: 'FechaEmisionXML',
        width: 165,
      },
      {
        title: 'Fecha de Recepción',
        field: 'FechaEmisionDocClm',
        width: 165,
      },
      {
        title: 'Nombre Emisor',
        field: 'NombreEmisor',
        widthGrow: 2,
      },
      {
        title: 'Cédula Emisor',
        field: 'NumeroCedulaEmisor',
        width: 140,
      },
      {
        title: 'Consecutivo Emisor',
        field: 'NumeroConsecutivoEmisor',
        widthGrow: 2,
      },
      {
        title: 'Total Impuesto',
        field: 'MontoTotalImpuesto',
        width: 130,
        hozAlign: 'right',
        formatter: (cell) => {
          const v = cell.getValue();
          return v != null ? Number(v).toLocaleString('es-CR') : '';
        },
      },
      {
        title: 'Total Factura',
        field: 'TotalFactura',
        width: 130,
        hozAlign: 'right',
        formatter: (cell) => {
          const v = cell.getValue();
          return v != null ? Number(v).toLocaleString('es-CR') : '';
        },
      },
      {
        title: 'Estado',
        field: 'Statuscambio',
        width: 160,
        hozAlign: 'left',
        formatter: (cell) => this.#statusBadge(cell.getValue()),
      },
      {
        title: 'Mensaje',
        field: 'Mensajecambio',
        width: 160,
      },
      {
        title: 'Num Doc Proveedor',
        field: 'ConsecutivoDoc',
        width: 160,
      },
      {
        title: 'Acciones',
        field: 'Id',
        width: 100,
        hozAlign: 'center',
        formatter: (_cell, _params, onRendered) => {
          onRendered(() => {});
          return this.#actionButtons();
        },
        cellClick: (e, cell) => {
          const row = cell.getRow().getData();
          if (e.target.closest('[data-action-type="options"]')) {
            this.#showRowDropdown(e, row);
          }
        },
      },
    ];
  }

  // ── Request Tabulator ─────────────────────────────────────────────────────

  async #tabulatorRequest(params) {
    const page     = params.page || 1;
    const pageSize = params.size || 10;
    this.#stepPos  = pageSize;

    const startPost = (page - 1) * pageSize + 1;

    const clave = this.inputClaveTarget.value.trim();
    const startDate = this.inputStartDateTarget.value;
    const endDate   = this.inputEndDateTarget.value;

    // Si no hay clave, validar fechas
    if (!clave) {
      if (!startDate || !endDate) return { data: [], last_page: 1 };
    }

    const queryParams = new URLSearchParams({
      StartDate:          startDate,
      EndDate:            endDate,
      DocType:            this.selectDocTypeTarget.value,
      Status:             this.selectStatusTarget.value,
      MessageType:        this.selectMessageTypeTarget.value,
      CompanyId:          this.#companyId ?? '',
      Consecutivo:        '',
      NombreEmisor:       this.inputNombreEmisorTarget.value,
      Clave:              clave,
      ConsecutivoEmisor:  this.inputConsecutivoEmisorTarget.value,
      useXMLDates:        this.checkUseXMLDatesTarget.checked,
      StartPost:          startPost,
      StepPost:           pageSize,
      Bandeja:            this.selectBandejaTarget.value,
      Cedula:             this.inputCedulaTarget.value,
      CodigoMoneda:       this.inputCodigoMonedaTarget.value,
    });

    try {
      const json = await this.#apiFetch(`/api/Documents/SearchDocumentsAccepted?${queryParams}`);

      if (!json.Data) {
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al obtener documentos', message: json.Message || 'Error desconocido' });
        return { data: [], last_page: 1 };
      }

      // Contadores de estado
      this.#quantities = {};
      (json.Data.DocumentQtyList || []).forEach(q => { this.#quantities[q.Status] = q.Quantity; });
      this.#renderStatusCounters();

      const docs = (json.Data.DocumentList || []).map(d => this.#mapDoc(d));

      const total    = docs[0]?.MaxQtyRowsFetch || 0;
      this.#totalRecords = total;
      const lastPage = Math.ceil(total / pageSize) || 1;

      if (docs.length > 0 && !this.#formChanged) {
        this.btnChartTarget.classList.remove('hidden');
      }

      showToast('Documentos obtenidos correctamente!', 'success');

      return { data: docs, last_page: lastPage };
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al obtener documentos', message: err.message });
      return { data: [], last_page: 1 };
    }
  }

  #mapDoc(doc) {
    return {
      ...doc,
      FechaEmisionXML:    this.#formatDateTime(doc.FechaEmisionXML),
      FechaEmisionDocClm: doc.FechaEmisionDoc ? this.#formatDateTime(doc.FechaEmisionDoc) : 'N/A',
      DocTypes:           DOC_TYPES[doc.DocType] ?? doc.DocType,
      Statuscambio:       doc.Status,
      Mensajecambio:      MESSAGE_TYPES[doc.Mensaje] ?? String(doc.Mensaje ?? ''),
    };
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  #statusBadge(status) {
    const s = DOC_STATUS[status];
    if (!s) return `<span style="background-color:#f3f4f6; color:#4b5563;"
                         class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">${status ?? ''}</span>`;
    return `<span style="background-color:${s.bg}; color:${s.color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${s.label}
    </span>`;
  }

  #actionButtons() {
    return `
      <button type="button" data-action-type="options" data-tooltip="Opciones"
              class="p-1.5 text-gray-600 rounded hover:bg-gray-100 transition-colors cursor-pointer">
        <span class="material-icons text-base pointer-events-none">more_vert</span>
      </button>`;
  }

  // ── Dropdown de opciones por fila ─────────────────────────────────────────

  #showRowDropdown(e, row) {
    document.getElementById('cl-row-dropdown')?.remove();

    const canSendAcceptance   = row.Status === 7 && row.IsComplete && !this.#companyInfo?.SendReceptAndApInv;
    const canPreview          = row.Status === 7;
    const canBandeja          = row.Bandeja != null && row.Bandeja !== '';
    const canReprocess        = row.Status === 4;
    const alreadyInSAP        = row.ConsecutivoDoc > 0;
    const canSAP              = row.Status === 1 && this.#hasPerm('F_CreateAPInvoice') && !alreadyInSAP;
    const xmlHaciendaAvail    = row.Status === 1 || row.Status === 4;

    const options = [
      {
        label: 'Ver PDF de Recepción',
        icon: 'picture_as_pdf',
        action: 'view-pdf',
        disabled: !row.HavePathReceptPDF,
        disabledReason: 'No se encontró un archivo PDF para este documento',
      },
      {
        label: 'Ver XML Resp Hacienda',
        icon: 'integration_instructions',
        action: 'view-xml',
        disabled: !xmlHaciendaAvail,
        disabledReason: 'Solo disponible para documentos Aceptados o Rechazados',
      },
      {
        label: 'Descargar XML Enviado',
        icon: 'download',
        action: 'download-xml-sent',
      },
      {
        label: 'Enviar Aceptación',
        icon: 'send',
        action: 'send-acceptance',
        disabled: !canSendAcceptance,
        disabledReason: 'Solo disponible para documentos Obtenidos del Correo que estén completos y sin envío automático',
      },
      {
        label: 'Previsualizar Aceptación',
        icon: 'file_open',
        action: 'preview-acceptance',
        disabled: !canPreview,
        disabledReason: 'Solo disponible para documentos en estado Obtenido del Correo',
      },
      {
        label: 'Obtenido del correo',
        icon: 'info',
        action: 'mail-info',
        disabled: !canBandeja,
        disabledReason: 'El documento no tiene información de bandeja',
      },
      {
        label: 'Consultar Información',
        icon: 'info',
        action: 'consult-info',
      },
      {
        label: 'Enviar a SAP',
        icon: 'ios_share',
        action: 'send-sap',
        disabled: !canSAP,
        disabledReason: alreadyInSAP
          ? `N° Consecutivo ${row.ConsecutivoDoc} — El documento ya fue creado en SAP`
          : 'Solo disponible para documentos Aceptados y con el permiso necesario',
      },
      {
        label: 'Reprocesar',
        icon: 'autorenew',
        action: 'reprocess',
        disabled: !canReprocess,
        disabledReason: 'Solo disponible para documentos Rechazados y con el permiso necesario',
      },
    ];

    const menu = document.createElement('div');
    menu.id = 'cl-row-dropdown';
    menu.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 min-w-[220px]';
    menu.style.top  = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;

    options.forEach(opt => {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative group/opt';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = opt.disabled
        ? 'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 cursor-not-allowed'
        : 'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors';
      btn.innerHTML = `<span class="material-icons text-base">${opt.icon}</span>${opt.label}`;
      btn.disabled = !!opt.disabled;

      if (!opt.disabled) {
        btn.addEventListener('click', () => {
          menu.remove();
          this.#handleRowAction(opt.action, row);
        });
      }

      wrapper.appendChild(btn);

      if (opt.disabled && opt.disabledReason) {
        btn.addEventListener('mouseenter', (ev) => this.#showDropdownTooltip(ev, opt.disabledReason));
        btn.addEventListener('mouseleave', () => this.#hideDropdownTooltip());
      }

      menu.appendChild(wrapper);
    });

    document.body.appendChild(menu);

    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        this.#hideDropdownTooltip();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)   menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight) menu.style.top  = `${window.innerHeight - rect.height - 8}px`;
  }

  async #handleRowAction(action, row) {
    switch (action) {
      case 'view-pdf':          await this.#viewPDF(row);             break;
      case 'view-xml':          await this.#viewXMLHacienda(row.Id);  break;
      case 'download-xml-sent': await this.#downloadXMLSent(row);     break;
      case 'send-acceptance':   await this.#sendAcceptance(row);      break;
      case 'preview-acceptance':       this.#openReceptPanel(row);    break;
      case 'mail-info':                this.#showMailInfo(row);        break;
      case 'consult-info':      await this.#consultInfo(row);         break;
      case 'send-sap':                 this.#sendToSAP(row);          break;
      case 'reprocess':         await this.#reprocess(row.Id);        break;
    }
  }

  // ── Acciones de fila ──────────────────────────────────────────────────────

  async #viewPDF(row) {
    if (!row.HavePathReceptPDF) {
      showToast('No se encontró un archivo PDF para este documento', 'info');
      return;
    }
    try {
      const json = await this.#apiFetch(`/api/Documents/DownloadPDF?docId=${row.Id}`);
      if (!json.Data) { showToast('No se pudo obtener el PDF', 'error'); return; }
      this.#openBase64InTab(json.Data, 'application/pdf');
      this.#downloadBase64(json.Data, `RECEP-${row.Id}-PDF`, 'application/pdf');
      showToast('PDF obtenido con éxito', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #viewXMLHacienda(id) {
    try {
      const json = await this.#apiFetch(`/api/Documents/GetDocumentXMLAccepted?docId=${id}`);
      if (!json.Data?.HrRespuestaXml) { showToast('No se encontró la respuesta XML de Hacienda', 'info'); return; }
      const decoded = this.#b64DecodeUnicode(json.Data.HrRespuestaXml);
      const blob    = new Blob([decoded], { type: 'application/xml' });
      const url     = URL.createObjectURL(blob);
      const tab     = window.open();
      if (tab) tab.location.href = url;
      showToast('XML obtenido con éxito', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #downloadXMLSent(row) {
    try {
      const response = await this.#apiFetchRaw(`/api/documents/receptions/${row.Id}/xml-sent`);
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = match ? match[1].replace(/['"]/g, '') : `RECEP-${row.Id}.xml`;
      const blob = await response.blob();
      this.#saveBlob(blob, filename);
      showToast('XML descargado con éxito', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #sendAcceptance(row) {
    try {
      await this.#apiFetch('/api/Documents/ReceptMessageFromMailParser/', {
        method: 'POST',
        body: JSON.stringify({
          Recepcion: {
            Id:                  row.Id,
            Mensaje:             row.Mensaje,
            DetalleMensaje:      row.DetalleMensaje,
            Sucursal:            1,
            Terminal:            1,
            CompanyId:           0,
            CondicionImpuesto:   row.CondicionImpuesto,
            TaxFactor:           row.TaxFactor,
            CodigoActividad:     row.CodigoActividadReceptor,
            UserId:              '',
          },
          editInfo: false,
        }),
        headers: { 'API': 'ApiFEUrl' },
      });
      showToast('Aceptación enviada con éxito', 'success');
      this.table?.replaceData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  #populateActivitySelect(selectedValue = null) {
    if (!this.hasReceptCodigoActividadTarget) return;
    const sel = this.receptCodigoActividadTarget;
    const preserve = selectedValue ?? sel.value;
    sel.innerHTML = '<option value="">-- Seleccione --</option>';
    this.#activityCodes.forEach(a => {
      const code = a.Code ?? a.code ?? '';
      const name = a.Name ?? a.Description ?? a.name ?? '';
      const opt  = document.createElement('option');
      opt.value       = code;
      opt.textContent = `${code} - ${name}`;
      sel.appendChild(opt);
    });
    if (preserve) sel.value = preserve;
    if (!sel.value && this.#activityCodes.length === 1) {
      sel.value = this.#activityCodes[0].Code ?? this.#activityCodes[0].code ?? '';
    }
  }

  #openReceptPanel(row) {
    this.#activeReceptDoc = row;
    this.receptDocNameTarget.value             = row.DocName || '';
    this.receptMensajeTarget.value             = String(row.Mensaje ?? '1');
    this.receptCondicionImpuestoTarget.value   = row.CondicionImpuesto || '01';
    this.receptTaxFactorTarget.value           = row.TaxFactor ?? '';
    this.receptDetalleMensajeTarget.value      = row.DetalleMensaje || '';
    this.#populateActivitySelect(row.CodigoActividadReceptor || '');

    this.receptBackdropTarget.classList.remove('hidden');
    this.receptPanelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  closeReceptPanel() {
    this.receptPanelTarget.classList.add('translate-x-full');
    this.receptBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async saveFromReceptPanel() {
    if (!this.#activeReceptDoc) return;
    try {
      showLoading('Procesando documento, espere por favor...');
      await this.#apiFetch('/api/Documents/ReceptMessageFromMailParser/', {
        method: 'POST',
        body: JSON.stringify({
          Recepcion: {
            Id:                this.#activeReceptDoc.Id,
            Mensaje:           parseInt(this.receptMensajeTarget.value),
            DetalleMensaje:    this.receptDetalleMensajeTarget.value,
            Sucursal:          1,
            Terminal:          1,
            CompanyId:         0,
            CondicionImpuesto: this.receptCondicionImpuestoTarget.value,
            TaxFactor:         parseFloat(this.receptTaxFactorTarget.value) || 0,
            CodigoActividad:   this.receptCodigoActividadTarget.value,
            UserId:            '',
          },
          editInfo: true,
        }),
        headers: { 'API': 'ApiFEUrl' },
      });
      hideLoading();
      showToast('Documento recepcionado con éxito', 'success');
      this.closeReceptPanel();
      this.table?.replaceData();
    } catch (err) {
      hideLoading();
      showToast(err.message, 'error');
    }
  }

  #showMailInfo(row) {
    this.infoTitleTarget.textContent = 'Información';
    this.infoBodyTarget.textContent  = row.Bandeja || '';
    this.infoModalTarget.classList.remove('hidden');
  }

  async #consultInfo(row) {
    this.infoFechaEmisionTarget.textContent = row.FechaEmisionXML
      ? row.FechaEmisionXML.substring(0, 10)
      : '';

    const detalle = row.DetalleMensaje || '';
    this.infoDetalleMensajeTarget.textContent = detalle;
    this.infoDetalleMensajeSectionTarget.classList.toggle('hidden', !detalle);

    if (row.ErrDetails) {
      this.infoErrorTarget.textContent = row.ErrDetails;
      this.infoErrorSectionTarget.classList.remove('hidden');
    } else {
      this.infoErrorSectionTarget.classList.add('hidden');
    }

    this.infoErrorHaciendaSectionTarget.classList.add('hidden');
    if (row.Status === 4) {
      try {
        const json = await this.#apiFetch(`/api/Documents/reception/${row.Id}/xml-response-message`);
        if (json.Data?.HrRespuestaXml) {
          // HrRespuestaXml puede venir en base64 — intentar decode
          let xmlStr = json.Data.HrRespuestaXml;
          try { xmlStr = this.#b64DecodeUnicode(xmlStr); } catch { /* usar como está */ }
          this.infoErrorHaciendaTarget.innerHTML = this.#formatHaciendaError(xmlStr);
          this.infoErrorHaciendaSectionTarget.classList.remove('hidden');
        }
      } catch {
        // No bloquear el panel por errores secundarios
      }
    }

    this.infoPanelBackdropTarget.classList.remove('hidden');
    this.infoPanelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  async copyClave() {
    const clave = this.infoClaveTarget.textContent.trim();
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = clave;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.copyTooltipTarget.classList.remove('hidden');
    clearTimeout(this._copyTooltipTimer);
    this._copyTooltipTimer = setTimeout(() => {
      this.copyTooltipTarget.classList.add('hidden');
    }, 1500);
  }

  closeInfoPanel() {
    this.infoPanelTarget.classList.add('translate-x-full');
    this.infoPanelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Contadores de estado ───────────────────────────────────────────────────

  #renderStatusCounters() {
    const STATUS_MAP = {
      1: { label: 'Aceptado',                   bg: '#e8f5ee', color: '#3a7d52' },
      2: { label: 'Procesando',                 bg: '#e8f0fe', color: '#1a56db' },
      3: { label: 'En Hacienda',                bg: '#e8f0fe', color: '#1a56db' },
      4: { label: 'Rechazado',                  bg: '#fdecea', color: '#c0392b' },
      5: { label: 'Error',                      bg: '#fffbeb', color: '#b45309' },
      6: { label: 'Reprocesar',                 bg: '#e8f0fe', color: '#1a56db' },
      7: { label: 'Obtenido del Correo',        bg: '#f3f4f6', color: '#4b5563' },
      8: { label: 'Obtenido Correo Automático', bg: '#f3f4f6', color: '#4b5563' },
    };

    const container = this.statusCountersTarget;
    container.innerHTML = '';

    Object.entries(this.#quantities).forEach(([status, qty]) => {
      if (!qty) return;
      const cfg = STATUS_MAP[status] ?? { label: `Estado ${status}`, bg: '#f3f4f6', color: '#4b5563' };
      const chip = document.createElement('span');
      chip.style.cssText = `background-color:${cfg.bg}; color:${cfg.color};`;
      chip.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold';
      chip.textContent = `${cfg.label}: ${qty.toLocaleString('es-CR')}`;
      container.appendChild(chip);
    });
  }


  #sendToSAP(row) {
    if (row.Status !== 1) {
      showToast('Esta opción no está disponible para el estado actual del documento', 'info');
      return;
    }
    if (!this.#hasPerm('F_CreateAPInvoice')) {
      showToast('No tiene permiso para realizar esta acción', 'info');
      return;
    }
    if (!this.#companyInfo?.DefaultTaxForXML) {
      this.infoTitleTarget.textContent = 'Configuración requerida';
      this.infoBodyTarget.textContent  = 'La compañía no tiene un Impuesto por Defecto para XML. Configure este valor antes de continuar.';
      this.infoModalTarget.classList.remove('hidden');
      return;
    }
    window.location.href = `/documents/receptions/${row.Id}/create?xmlDocType=${row.DocType}`;
  }

  async #reprocess(id) {
    if (!this.#hasPerm('Documents_Acceptance_Reprocess')) {
      showToast('No tiene permiso para reprocesar este documento', 'info');
      return;
    }
    try {
      await this.#apiFetch(
        `/api/Documents/${id}/Reprocess?isReceptionDocument=true&companyId=${this.#companyId}`,
        { method: 'PATCH', body: JSON.stringify({}), headers: { 'API': 'ApiFEUrl' } }
      );
      showToast('Solicitud de reprocesamiento enviada', 'success');
      this.table?.replaceData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Descarga Masiva ────────────────────────────────────────────────────────

  async bulkDownload() {
    const confirmed = await confirm(
      'Se creará una solicitud de descarga masiva según los filtros aplicados. Los archivos serán enviados al correo del usuario.',
      'Descarga Masiva',
      ALERT_TYPES.INFO
    );
    if (!confirmed) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await this.#apiFetch('/api/Report/BulkDownloadOfDocuments/', {
        method: 'POST',
        body: JSON.stringify({
          Id:             0,
          CreationDate:   today,
          UserId:         '',
          StartDate:      this.inputStartDateTarget.value,
          EndDate:        this.inputEndDateTarget.value,
          CompanyId:      this.#companyId,
          DocType:        2,
          Status:         0,
          AttemptsToSend: 0,
          LastAttempt:    null,
          UseXMLDate:     false,
          KindOfDocuments:'01',
          ToEmail:        '',
          CCEmail:        '',
        }),
      });
      showToast('Solicitud de descarga masiva creada con éxito', 'success');
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error en descarga masiva', message: err.message });
    }
  }

  closeInfoModal() {
    this.infoModalTarget.classList.add('hidden');
  }

  // ── Formulario handlers ────────────────────────────────────────────────────

  // Recarga la tabla tras recepcionar un documento desde el panel de carga
  // (evento documents-reception:done)
  reloadTable() {
    this.table?.replaceData();
  }

  search() {
    const clave     = this.inputClaveTarget.value.trim();
    const startDate = this.inputStartDateTarget.value;
    const endDate   = this.inputEndDateTarget.value;
    const today     = this.#todayISO();

    if (!clave && (!startDate || !endDate)) {
      this.infoTitleTarget.textContent = 'Filtros requeridos';
      this.infoBodyTarget.textContent  = 'Cuando no se especifica una clave, los campos de fechas son requeridos para realizar la consulta.';
      this.infoModalTarget.classList.remove('hidden');
      return;
    }

    if (!clave && (startDate > today || endDate > today)) {
      this.infoTitleTarget.textContent = 'Fechas inválidas';
      this.infoBodyTarget.textContent  = 'Los campos de fechas no pueden apuntar a una fecha futura.';
      this.infoModalTarget.classList.remove('hidden');
      return;
    }

    if (!clave && startDate > endDate) {
      this.infoTitleTarget.textContent = 'Fechas inválidas';
      this.infoBodyTarget.textContent  = 'La fecha de inicio no puede ser posterior a la fecha final.';
      this.infoModalTarget.classList.remove('hidden');
      return;
    }

    this.#formChanged = false;
    this.btnChartTarget.classList.add('hidden');
    this.table?.setPage(1);
  }

  openChartModal() {
    const q      = this.#quantities;
    const labels = Object.values(DOC_STATUS).map(s => s.label);
    const values = Object.keys(DOC_STATUS).map(k => q[parseInt(k)] || 0);
    const total  = values.reduce((a, b) => a + b, 0);

    if (total === 0) {
      showToast('No hay datos para mostrar', 'warning');
      return;
    }

    // Mostrar modal info con resumen de estados
    const resumen = Object.entries(DOC_STATUS)
      .filter(([k]) => (q[parseInt(k)] || 0) > 0)
      .map(([k, s]) => `${s.label}: ${q[parseInt(k)]}`)
      .join('\n');

    this.infoTitleTarget.textContent = 'Distribución de Documentos';
    this.infoBodyTarget.textContent  = resumen;
    this.infoModalTarget.classList.remove('hidden');
  }

  setTodayStartDate() {
    this.inputStartDateTarget.value = this.#todayISO();
  }

  setTodayEndDate() {
    this.inputEndDateTarget.value = this.#todayISO();
  }

  toggleUseXMLDates() {
    const checked = this.checkUseXMLDatesTarget.checked;
    this.labelDateTypeTarget.textContent = checked ? 'Emisión' : 'Recepción';
  }

  onCodigoMonedaInput() {
    const val  = this.inputCodigoMonedaTarget.value.toUpperCase();
    const list = document.getElementById('currency-codes-list');
    if (!list) return;
    list.innerHTML = '';
    if (!val) return;
    const matches = this.#currencyCodes.filter(c => c.toUpperCase().startsWith(val)).slice(0, 8);
    matches.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      list.appendChild(opt);
    });
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────

  async #loadInitialData() {
    if (!this.#companyId) return;
    try {
      const [bandejas, currencies, companyInfo, activityRes] = await Promise.allSettled([
        this.#apiFetch(`/api/Documents/GetBandejasReceptores?CompanyId=${this.#companyId}`),
        this.#apiFetch(`/api/Documents/GetCurrencyCodeAD/?companyId=${this.#companyId}`),
        this.#apiFetch(`/api/companies/${this.#companyId}`),
        this.#apiFetch(`/api/Companies/${this.#companyId}/activity-codes`),
      ]);

      // Bandejas
      if (bandejas.status === 'fulfilled' && bandejas.value.Data) {
        this.#bandejas = bandejas.value.Data;
        const select = this.selectBandejaTarget;
        select.innerHTML = '<option value="">Todas</option>';
        this.#bandejas.forEach(b => {
          const opt = document.createElement('option');
          opt.value       = b.BandejaReceptor;
          opt.textContent = b.BandejaReceptor;
          select.appendChild(opt);
        });
      }

      // Monedas
      if (currencies.status === 'fulfilled' && currencies.value.Data) {
        this.#currencyCodes = currencies.value.Data.map(c => c.Code ?? c);
      }

      // Info empresa
      if (companyInfo.status === 'fulfilled' && companyInfo.value.Data) {
        const d = companyInfo.value.Data;
        this.#companyInfo = {
          DefaultTaxForXML:    d.DefaultTaxForXML,
          SendReceptAndApInv:  d.SendReceptAndApInv,
          UseFactProv:         d.UseFactProv,
        };
      }

      // Códigos de actividad económica
      if (activityRes.status === 'fulfilled') {
        const val = activityRes.value;
        console.log('[receptions] activity-codes raw:', val);
        this.#activityCodes = val?.Data ?? val ?? [];
        console.log('[receptions] #activityCodes parsed:', this.#activityCodes);
        this.#populateActivitySelect();
      } else {
        console.warn('[receptions] activity-codes failed:', activityRes.reason);
      }
    } catch {
      // Cargar sin datos dinámicos — no es fatal
    }
  }

  // ── Tooltip dropdown ─────────────────────────────────────────────────────

  #showDropdownTooltip(event, text) {
    let tip = document.getElementById('cl-dropdown-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'cl-dropdown-tooltip';
      tip.style.cssText = [
        'position:fixed',
        'z-index:10000',
        'background:#1f2937',
        'color:#fff',
        'font-size:12px',
        'line-height:1.5',
        'border-radius:8px',
        'padding:8px 12px',
        'max-width:220px',
        'pointer-events:none',
        'box-shadow:0 4px 12px rgba(0,0,0,.25)',
      ].join(';');
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    const rect = event.currentTarget.getBoundingClientRect();
    let left = rect.right + 8;
    let top  = rect.top + rect.height / 2;
    tip.style.visibility = 'hidden';
    tip.style.display    = 'block';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    if (left + tw > window.innerWidth - 8) left = rect.left - tw - 8;
    top = top - th / 2;
    tip.style.left       = `${left}px`;
    tip.style.top        = `${top}px`;
    tip.style.visibility = 'visible';
  }

  #hideDropdownTooltip() {
    const tip = document.getElementById('cl-dropdown-tooltip');
    if (tip) tip.style.display = 'none';
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  #todayISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  #formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }


  // ── Helpers de blobs/base64 ──────────────────────────────────────────────

  #openBase64InTab(b64, mimeType) {
    const binary = atob(b64);
    const buf    = new ArrayBuffer(binary.length);
    const view   = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    const blob = new Blob([view], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const tab  = window.open();
    if (tab) tab.location.href = url;
  }

  #downloadBase64(b64, fileName, mimeType) {
    const binary = atob(b64);
    const buf    = new ArrayBuffer(binary.length);
    const view   = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    this.#saveBlob(new Blob([view], { type: mimeType }), fileName);
  }

  #saveBlob(blob, fileName) {
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
  }

  #b64DecodeUnicode(str) {
    return decodeURIComponent(
      atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
  }

  #formatHaciendaError(text) {
    if (!text) return '';

    const bracketStart = text.indexOf('[');
    const bracketEnd   = text.lastIndexOf(']');

    // Sin estructura de array → card rojo simple
    if (bracketStart === -1) {
      return `
        <div class="rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="text-sm text-red-800 leading-relaxed break-all">${this.#escapeHtml(text)}</p>
        </div>`;
    }

    const preamble     = text.substring(0, bracketStart).trim();
    const arrayContent = text.substring(bracketStart + 1, bracketEnd !== -1 ? bracketEnd : undefined).trim();

    const entries = [];
    const regex = /(-?\d+),\s*""([\s\S]*?)"",\s*-?\d+,\s*-?\d+/g;
    let match;
    while ((match = regex.exec(arrayContent)) !== null) {
      entries.push({ code: match[1], message: match[2].trim() });
    }

    let html = '';

    if (preamble) {
      html += `<p class="text-sm text-gray-600 mb-3 leading-relaxed break-all">${this.#escapeHtml(preamble)}</p>`;
    }

    if (entries.length > 0) {
      html += '<div class="space-y-2">';
      for (const e of entries) {
        html += `
          <div class="rounded-lg border border-red-200 bg-red-50 p-3">
            <span class="inline-block text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full mb-1.5">
              Código ${this.#escapeHtml(e.code)}
            </span>
            <p class="text-sm text-red-800 leading-relaxed break-all">${this.#escapeHtml(e.message)}</p>
          </div>`;
      }
      html += '</div>';
    } else if (arrayContent) {
      html += `
        <div class="rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="text-sm text-red-800 leading-relaxed break-all">${this.#escapeHtml(arrayContent)}</p>
        </div>`;
    }

    return html;
  }

  #escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── apiFetch (patrón canónico CLAUDE.md) ─────────────────────────────────

  async #apiFetch(url, options = {}) {
    const isFESync = (options.headers?.['API'] ?? 'ApiAppUrl') === 'ApiFEUrl';

    const token = isFESync
      ? (JSON.parse(sessionStorage.getItem('currentFEUser') || '{}')?.access_token ?? null)
      : (Storage.get('Session') || {}).access_token;

    const company   = SStore.get('CurrentCompany');
    const companyId = company?.companyId ?? this.#companyId;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type':             'application/json',
        'API':                      'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token     ? { Authorization:   `Bearer ${token}` } : {}),
        ...(companyId ? { 'Cl-Company-Id': String(companyId) } : {}),
        ...(options.headers || {}),
      },
    });

    const clMessage = response.headers.get('cl-message');
    const decodedMessage = clMessage ? (() => {
      try { return decodeURIComponent(clMessage); } catch { return clMessage; }
    })() : null;

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(decodedMessage || text || `HTTP ${response.status}`);
    }

    const contentType   = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    if (response.status === 204 || contentLength === '0' || !contentType.includes('json')) return {};

    const text = await response.text();
    if (!text || !text.trim()) return {};
    const json = JSON.parse(text);
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }

  // Variante raw para blobs con headers (Descargar XML Enviado)
  async #apiFetchRaw(url, options = {}) {
    const token     = (Storage.get('Session') || {}).access_token;
    const company   = SStore.get('CurrentCompany');
    const companyId = company?.companyId ?? this.#companyId;

    return await fetch(url, {
      ...options,
      headers: {
        'API':                      'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token     ? { Authorization:   `Bearer ${token}` } : {}),
        ...(companyId ? { 'Cl-Company-Id': String(companyId) } : {}),
        ...(options.headers || {}),
      },
    });
  }
}
