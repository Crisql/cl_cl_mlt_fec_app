import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';
import { showLoading, hideLoading } from 'vendor/clavisco/overlay';

/**
 * DocumentsEmailsController — Reporte de correos enviados.
 *
 * Migración del componente Angular EmailReportComponent
 * (pages/documents/email-report → ruta /email_report → nuevo path /documents/emails).
 *
 * Funcionalidad:
 *   - Formulario de filtros: fechas, tipo doc, estado correo, clave, to, cc, id receptor, nombre receptor
 *   - Tabla Tabulator server-side paginada
 *   - Acción "Ver detalle" → panel lateral con el campo Details (pre-formatted)
 *   - Acción "Ver documento" → navega a /documents/issued?clave=DocClave
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    'inputInitialDate',
    'inputEndDate',
    'selectDocType',
    'selectEmailStatus',
    'inputDocClave',
    'inputEmailTo',
    'inputEmailCC',
    'inputRcprId',
    'inputRcprNombre',
    'panel',
    'panelBackdrop',
    'panelContent',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ────────────────────────────────────────────────────────

  #companyId    = null;
  #totalRecords = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company   = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ?? null;

    const today = this.#todayString();
    this.inputInitialDateTarget.value = today;
    this.inputEndDateTarget.value     = today;

    super.connect();

    // Delegación para botones dentro de celdas Tabulator
    this.tableTarget.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action-type]');
      if (!btn) return;
      const rowData = btn.dataset.rowData ? JSON.parse(btn.dataset.rowData) : null;
      if (!rowData) return;
      if (btn.dataset.actionType === 'view-detail')   this.#openDetail(rowData);
      if (btn.dataset.actionType === 'view-document') this.#goToDocument(rowData);
    });
  }

  // ── Acciones públicas ─────────────────────────────────────────────────────

  todayInitial() { this.inputInitialDateTarget.value = this.#todayString(); }
  todayEnd()     { this.inputEndDateTarget.value     = this.#todayString(); }

  search() {
    const initial = this.inputInitialDateTarget.value;
    const end     = this.inputEndDateTarget.value;
    if (!initial || !end) {
      showToast('Ingrese ambas fechas para consultar.', 'warning');
      return;
    }
    if (initial > end) {
      showToast('La fecha de inicio no puede ser posterior a la fecha final.', 'warning');
      return;
    }
    this.table?.setData();
  }

  openPanel()  {
    this.panelBackdropTarget.classList.remove('hidden');
    this.panelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  closePanel() {
    this.panelTarget.classList.add('translate-x-full');
    this.panelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Config Tabulator ──────────────────────────────────────────────────────

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      data: undefined,   // evita que el [] heredado del base suprima el fetch remoto inicial (Tabulator requestDataCheck)
      height: '100%',
      maxHeight: undefined,  // sobreescribe el default 500px del TabulatorController
      layout: 'fitColumns',
      locale: TABULATOR_LOCALE,
      langs:  TABULATOR_LANGS,
      pagination: true,
      paginationMode: 'remote',
      paginationSize: 10,
      paginationSizeSelector: [5, 10, 15, 25],
      ajaxURL:         '/api/Email/GetOutgoingMailsByFilters/',
      ajaxRequestFunc: (_url, _config, params) => this.#fetchPage(params),
      ajaxResponse:    (_url, _params, response) => response,
      paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
        const total = this.#totalRecords;
        if (!total) return '';
        const to = Math.min(currentRow + _pageSize - 1, total);
        return `Mostrando ${currentRow.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
      },
      columns: this.getColumns(),
      placeholder: 'No hay datos para mostrar',
    };
  }

  getColumns() {
    return [
      {
        title: 'Fecha creación',
        field: 'EmailCreateDate',
        widthGrow: 1.5,
        formatter: (cell) => this.#formatDateTime(cell.getValue()),
      },
      {
        title: 'Último intento',
        field: 'EmailLastAttempt',
        widthGrow: 1.5,
        formatter: (cell) => this.#formatDateTime(cell.getValue()),
      },
      {
        title: 'Estado correo',
        field: 'EmailStatus',
        widthGrow: 1,
        formatter: (cell) => {
          const statusMap = { 1: 'pendiente', 2: 'enviando', 3: 'error', 4: 'enviado' };
          return this.#emailStatusBadge(statusMap[cell.getValue()] ?? String(cell.getValue()));
        },
      },
      { title: 'Email To',        field: 'EmailOutputTo',  widthGrow: 2 },
      { title: 'Email CC',        field: 'EmailOutputCC',  widthGrow: 2 },
      { title: 'Remitente',       field: 'SenderEmail',    widthGrow: 2 },
      { title: 'Clave Doc',       field: 'DocClave',       widthGrow: 2 },
      { title: 'Nombre receptor', field: 'RcprNombre',     widthGrow: 2 },
      { title: 'ID receptor',     field: 'RcprIdeNumero',  widthGrow: 1 },
      {
        title: 'Acciones',
        field: '_actions',
        hozAlign: 'center',
        headerSort: false,
        widthGrow: 0.8,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const data = JSON.stringify(row).replace(/"/g, '&quot;');
          const hasDetail = row.Details && row.Details.trim() !== '';
          const detailTooltip = hasDetail
            ? 'Ver detalle del correo'
            : 'El correo debe tener detalle registrado para usar esta opción';
          return `
            <div class="flex items-center justify-center gap-1">
              <button type="button"
                      data-action-type="view-detail"
                      data-row-data="${data}"
                      data-tooltip="${detailTooltip}"
                      ${hasDetail ? '' : 'disabled'}
                      class="p-1.5 rounded transition-colors ${hasDetail ? 'text-blue-600 hover:bg-blue-50 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}">
                <span class="material-icons text-base">lists</span>
              </button>
              <button type="button"
                      data-action-type="view-document"
                      data-row-data="${data}"
                      data-tooltip="Ver documento en Documentos Emitidos"
                      class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                <span class="material-icons text-base">article</span>
              </button>
            </div>`;
        },
      },
    ];
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  async #fetchPage(params) {
    const page = params.page  ?? 1;
    const size = params.size  ?? 10;
    const startPos = page - 1;  // API espera número de página base-0, no offset

    const query = new URLSearchParams({
      CompanyId:     this.#companyId ?? '',
      InitialDate:   this.inputInitialDateTarget.value,
      EndDate:       this.inputEndDateTarget.value,
      DocType:       this.selectDocTypeTarget.value,
      EmailStatus:   this.selectEmailStatusTarget.value,
      DocClave:      this.inputDocClaveTarget.value,
      EmailOutputTo: this.inputEmailToTarget.value,
      EmailOutputCC: this.inputEmailCCTarget.value,
      RcprIdeNumero: this.inputRcprIdTarget.value,
      RcprNombre:    this.inputRcprNombreTarget.value,
      startPos,
      stepPos:       size,
    });

    this.table?.alert(TABULATOR_LOADING_HTML);
    try {
      const json = await this.#apiFetch(`/api/Email/GetOutgoingMailsByFilters/?${query}`);
      const total = json.Data?.[0]?.MaxQtyRowsFetch ?? 0;
      this.#totalRecords = total;
      const lastPage = Math.max(1, Math.ceil(total / size));
      return { data: json.Data ?? [], last_page: lastPage };
    } catch (err) {
      showToast(err.message || 'Error al consultar correos.', 'error');
      return { data: [], last_page: 1 };
    } finally {
      this.table?.clearAlert();
    }
  }

  #openDetail(rowData) {
    if (!rowData.Details || rowData.Details.trim() === '') {
      showToast('Este registro no posee detalle.', 'info');
      return;
    }
    this.panelContentTarget.textContent = rowData.Details;
    this.openPanel();
  }

  #goToDocument(rowData) {
    if (!rowData.DocClave) {
      showToast('Sin clave de documento.', 'info');
      return;
    }
    Turbo.visit(`/documents/issued?clave=${encodeURIComponent(rowData.DocClave)}`);
  }

  #emailStatusBadge(status) {
    const map = {
      pendiente:  { bg: '#f3f4f6', color: '#6b7280', label: 'Pendiente'  },
      enviando:   { bg: '#e8f0fe', color: '#1a56db', label: 'Enviando'   },
      error:      { bg: '#fdecea', color: '#c0392b', label: 'Error'      },
      enviado:    { bg: '#e8f5ee', color: '#3a7d52', label: 'Enviado'    },
    };
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    return `<span style="background-color:${bg}; color:${color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${label}
    </span>`;
  }

  #formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  #todayString() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  async #apiFetch(url, options = {}) {
    const token     = (Storage.get('Session') || {}).access_token;
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

    const hasBody = response.status !== 204 &&
                    response.headers.get('content-length') !== '0' &&
                    response.headers.get('content-type')?.includes('application/json');
    if (!hasBody) return { Message: decodedMessage || null };

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
