import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * DocumentsIssuedController — Búsqueda de documentos emitidos (FE/ND/NC/TE/FEC/FEE/REP).
 *
 * Replica la funcionalidad del componente Angular DocumentsComponent
 * (pages/documents/documents/documents.component.ts):
 *
 *   - Formulario de filtros: 10 campos (fechas, consecutivo, estado, cédula,
 *     código moneda, clave, receptor, consecutivo FE, tipo doc)
 *   - Botón "Hoy" en ambas fechas
 *   - Parámetro URL ?clave=xxx pre-llena el campo Clave
 *   - Tabla Tabulator server-side: FechaFact, N° FE, N° Ref, Receptor, Estado, Total
 *   - Íconos de estado como badges coloreados
 *   - Menú de opciones por fila (dropdown): Ver PDF, Descargar PDF, Ver/Descargar XML Hacienda,
 *     Descargar Doc XML, Correos, Consultar Info, Omitir Validaciones, Anulación Interna, Reprocesar
 *   - Contadores de estado en toolbar
 *   - Botón "Más Información" (chart) — visible solo tras búsqueda exitosa sin cambios en form
 *   - Botón "Descarga Masiva" — visible solo si perm F_CreateBulkDownloadOfDocuments
 *   - Modales: Correos (tabla + reenvío), Info, Chart (canvas), Confirmación, Error
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,

    // Formulario de filtros
    'inputStartDate', 'inputEndDate',
    'inputConsecutivo', 'selectStatus',
    'inputCedula', 'inputCodigoMoneda',
    'inputClave', 'inputReceptor',
    'inputConsecutivoFE', 'selectDocType',

    // Toolbar
    'statusCounters', 'btnChart', 'btnBulkDownload',

    // Panel lateral correos
    'emailModal', 'emailPanelBackdrop', 'emailLoader', 'emailTable', 'emailEmpty',
    'otherEmailsForm', 'inputEmailTo', 'errorEmailTo', 'inputEmailCC', 'errorEmailCC', 'btnResend',

    // Panel lateral info
    'infoModal', 'infoPanelBackdrop', 'infoClave', 'copyTooltip', 'infoFechaEmision',
    'infoErrorSection', 'infoError',
    'infoErrorHaciendaSection', 'infoErrorHacienda',

    // Modal chart
    'chartModal', 'chartCanvas',

    // Modal confirmación
    'confirmModal', 'confirmIcon', 'confirmTitle', 'confirmSubtitle',

    // Modal error
    'errorModal', 'errorTitle', 'errorSubtitle',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ─────────────────────────────────────────────────────────

  /** Empresa activa */
  #companyId = null;

  /** Permisos del usuario */
  #permissions = [];

  /** Tamaño de página actual (lo gestiona Tabulator, lo guardamos para bulkDownload) */
  #stepPos = 10;

  /** Contadores de estado (del último fetch) */
  #quantities = {};

  /** Total real de registros (para el counter de paginación) */
  #totalRecords = 0;

  /** Tabla de correos (Tabulator secundaria) */
  #emailTabulator = null;

  /** Id del documento activo en el modal de correos */
  #activeEmailDocId = null;

  /** Gráfico (Chart.js) */
  #chart = null;

  /** Callback de confirmación pendiente */
  #confirmCallback = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company     = SStore.get('CurrentCompany');
    const permissions = SStore.get('Permissions');

    this.#companyId   = company?.companyId ? parseInt(company.companyId) : null;
    this.#permissions = Array.isArray(permissions) ? permissions : [];

    // Mostrar botón descarga masiva si tiene permiso
    if (this.#hasPerm('F_CreateBulkDownloadOfDocuments')) {
      this.btnBulkDownloadTarget.classList.remove('hidden');
    }

    // Inicializar fechas con hoy
    const today = this.#todayISO();
    this.inputStartDateTarget.value = today;
    this.inputEndDateTarget.value   = today;

    // Leer ?clave= ANTES de super.connect() para que el primer request de Tabulator ya lo incluya
    const urlParams = new URLSearchParams(window.location.search);
    const claveParam = urlParams.get('clave');
    if (claveParam) this.inputClaveTarget.value = claveParam;

    super.connect(); // inicializa Tabulator; dispara ajaxRequestFunc con page=1 automáticamente
  }

  disconnect() {
    this.#emailTabulator?.destroy();
    this.#chart?.destroy();
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
      // Paginación remota: Tabulator gestiona el UI; nosotros fetcheamos por página
      pagination: true,
      paginationMode: 'remote',
      paginationSize: 10,
      paginationSizeSelector: [5, 10, 15],
      // paginationCounter custom — Tabulator calcula el total como last_page*pageSize, lo que
      // sobreestima cuando la última página no está llena. Usamos el total real del servidor.
      paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
        const total = this.#totalRecords;
        if (!total) return '';
        const from = currentRow;
        const to   = Math.min(currentRow + _pageSize - 1, total);
        return `Mostrando ${from.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
      },
      // ajaxURL es requerido para activar el modo remote; el request real lo hace ajaxRequestFunc
      ajaxURL: '/api/documents',
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
        title: 'Fecha Fact.',
        field: 'FechaFact',
        width: 150,
      },
      {
        title: 'N° FE',
        field: 'NumeroConsecutivo',
        widthGrow: 2,
      },
      {
        title: 'N° Ref',
        field: 'Consecutivo',
        widthGrow: 1,
      },
      {
        title: 'Receptor',
        field: 'RcprNombre',
        widthGrow: 2,
      },
      {
        title: 'Estado',
        field: 'StatusForTable',
        width: 140,
        hozAlign: 'left',
        formatter: (cell) => this.#statusBadge(cell.getValue()),
      },
      {
        title: 'Total',
        field: 'TotalComprobante',
        width: 130,
        hozAlign: 'right',
      },
      {
        title: 'Acciones',
        field: 'Id',
        width: 80,
        hozAlign: 'center',
        formatter: () => this.#optionsButton(),
        cellClick: (e, cell) => {
          if (e.target.closest('[data-action-type="options"]')) {
            this.#showRowDropdown(e, cell.getRow().getData());
          }
        },
      },
    ];
  }

  // ── API fetch (llamado por Tabulator en cada cambio de página/tamaño) ────────

  async #tabulatorRequest(params) {
    // params.page = página actual (1-based), params.size = registros por página
    const page     = params.page || 1;
    const pageSize = params.size || 10;
    this.#stepPos  = pageSize;

    // StartPost es el índice del primer registro (1-based), no el número de página
    // Página 1 → StartPost=1, Página 2 → StartPost=11, Página 3 → StartPost=21, etc.
    const startPost = (page - 1) * pageSize + 1;

    const queryParams = new URLSearchParams({
      StartDate:     this.inputStartDateTarget.value,
      EndDate:       this.inputEndDateTarget.value,
      DoctType:      this.selectDocTypeTarget.value,
      Status:        this.selectStatusTarget.value,
      Consecutivo:   this.inputConsecutivoTarget.value,
      ConsecutivoFE: this.inputConsecutivoFETarget.value,
      Receptor:      this.inputReceptorTarget.value,
      Cedula:        this.inputCedulaTarget.value,
      Clave:         this.inputClaveTarget.value,
      CodigoMoneda:  this.inputCodigoMonedaTarget.value,
      StartPost:     startPost,
      StepPost:      pageSize,
    });

    const json = await this.#apiFetch(`/api/documents?${queryParams}`);

    if (!json.Data) {
      this.#showErrorModal('Se produjo un error al obtener los documentos', json.Message || 'Error desconocido');
      // Retornar formato válido para que Tabulator no quede en estado roto
      return { data: [], last_page: 1 };
    }

    // Contadores de estado
    this.#quantities = {};
    (json.Data.DocumentQtyList || []).forEach(q => { this.#quantities[q.Status] = q.Quantity; });
    this.#renderStatusCounters();

    // Mapear documentos
    const docs = (json.Data.DocumentList || []).map(d => this.#mapDocument(d));

    // MaxQtyRowsFetch viene en cada objeto del listado con el total real de registros
    const total    = docs[0]?.MaxQtyRowsFetch || 0;
    this.#totalRecords = total;
    const lastPage = Math.ceil(total / pageSize) || 1;

    if (docs.length > 0) this.btnChartTarget.classList.remove('hidden');

    showToast('Documentos obtenidos correctamente!', 'success');

    // Tabulator espera { data: [...], last_page: N } para paginación remota
    return { data: docs, last_page: lastPage };
  }

  #mapDocument(doc) {
    return {
      ...doc,
      CodigoMoneda:    this.#normalizeCurrency(doc.CodigoMoneda),
      TotalComprobante: this.#normalizeCurrency(doc.CodigoMoneda) +
                        Number(doc.TotalComprobante).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'),
      StatusForTable:  this.#statusLabel(doc.Status),
      FechaFact:       this.#formatDate(doc.FechaFact),
    };
  }

  #normalizeCurrency(code) {
    if (code === '₡' || code === '¢') return '₡';
    if (code === '$') return '$';
    if (code === '€') return '€';
    return code || '';
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  /** Devuelve texto del estado para mostrar en la tabla como badge */
  #statusLabel(status) {
    const map = {
      1: { label: 'Aceptado',    bg: '#e8f5ee', color: '#3a7d52' },
      2: { label: 'Procesando',  bg: '#e8f0fe', color: '#1a56db' },
      3: { label: 'En Hacienda', bg: '#e8f0fe', color: '#1a56db' },
      4: { label: 'Rechazado',   bg: '#fdecea', color: '#c0392b' },
      5: { label: 'Error',       bg: '#fffbeb', color: '#b45309' },
      6: { label: 'Reprocesar',  bg: '#e8f0fe', color: '#1a56db' },
      7: { label: 'Anulado',     bg: '#fdecea', color: '#c0392b' },
    };
    return map[status] ? { ...map[status], status } : { label: 'N/A', bg: '#f3f4f6', color: '#6b7280', status };
  }

  #statusBadge(val) {
    if (!val || typeof val !== 'object') return '';
    return `<span style="background-color:${val.bg}; color:${val.color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${val.label}
    </span>`;
  }

  #optionsButton() {
    return `
      <button type="button" data-action-type="options" data-tooltip="Opciones"
              class="p-1.5 text-gray-600 rounded hover:bg-gray-100 transition-colors cursor-pointer">
        <span class="material-icons text-base">more_vert</span>
      </button>`;
  }

  // ── Dropdown de opciones por fila ─────────────────────────────────────────

  #showRowDropdown(e, row) {
    // Eliminar dropdown previo si existe
    document.getElementById('cl-row-dropdown')?.remove();

    const options = [
      { label: 'Ver PDF',               icon: 'picture_as_pdf', action: 'view-pdf'     },
      { label: 'Descargar PDF',         icon: 'download',       action: 'download-pdf' },
      {
        label: 'Ver XML (Resp Hacienda)', icon: 'terminal', action: 'view-xml',
        disabled: row.Status !== 1 && row.Status !== 4,
        disabledReason: 'Solo disponible para documentos en estado Aceptado o Rechazado',
      },
      {
        label: 'Descargar XML (Resp Hacienda)', icon: 'download', action: 'download-xml',
        disabled: row.Status !== 1 && row.Status !== 4,
        disabledReason: 'Solo disponible para documentos en estado Aceptado o Rechazado',
      },
      {
        label: 'Descargar Doc XML', icon: 'description', action: 'download-doc-xml',
        disabled: row.Status === 5,
        disabledReason: 'No disponible para documentos en estado Error',
      },
      { label: 'Correos',               icon: 'mail',     action: 'emails' },
      { label: 'Consultar Información', icon: 'info',     action: 'info'   },
      {
        label: 'Omitir Validaciones', icon: 'lock_open', action: 'skip-validations',
        disabled: row.Status !== 5,
        disabledReason: 'Solo disponible para documentos en estado Error',
      },
      {
        label: 'Anulación Interna', icon: 'cancel', action: 'internal-cancel',
        disabled: row.Status === 7 || row.DocType !== '08',
        disabledReason: row.Status === 7
          ? 'El documento ya se encuentra anulado'
          : 'Solo disponible para documentos de tipo FEC (08)',
      },
      {
        label: 'Reprocesar', icon: 'autorenew', action: 'reprocess',
        disabled: row.Status !== 4,
        disabledReason: 'Solo disponible para documentos en estado Rechazado',
      },
    ];

    const menu = document.createElement('div');
    menu.id = 'cl-row-dropdown';
    menu.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 min-w-[210px]';
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

      // Tooltip descriptivo solo en opciones inhabilitadas — position:fixed para evitar clipping
      if (opt.disabled && opt.disabledReason) {
        btn.addEventListener('mouseenter', (ev) => {
          this.#showDropdownTooltip(ev, opt.disabledReason);
        });
        btn.addEventListener('mouseleave', () => {
          this.#hideDropdownTooltip();
        });
      }

      menu.appendChild(wrapper);
    });

    document.body.appendChild(menu);

    // Cerrar al hacer click fuera
    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        this.#hideDropdownTooltip();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);

    // Ajustar para que no salga de la ventana
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  }

  async #handleRowAction(action, row) {
    switch (action) {
      case 'view-pdf':         this.#viewPDF(row.Id);          break;
      case 'download-pdf':     this.#downloadPDF(row.Id, row.NumeroConsecutivo); break;
      case 'view-xml':         this.#viewXML(row.Id);          break;
      case 'download-xml':     this.#downloadXML(row.Id, row.NumeroConsecutivo); break;
      case 'download-doc-xml': this.#downloadDocXML(row.Id, row.NumeroConsecutivo); break;
      case 'emails':           this.#openEmailModal(row.Id);   break;
      case 'info':             this.#openInfoModal(row);        break;
      case 'skip-validations': this.#skipValidations(row.Id);  break;
      case 'internal-cancel':  this.#internalCancel(row);      break;
      case 'reprocess':        this.#reprocess(row.Id);        break;
    }
  }

  // ── Acciones de fila ──────────────────────────────────────────────────────

  async #viewPDF(id) {
    try {
      const json = await this.#apiFetch(`/api/Report/PrintInvoicePDF?id=${id}`);
      if (!json.Data) { showToast('No se pudo obtener el PDF', 'error'); return; }
      this.#openBase64InTab(json.Data, 'application/pdf');
      showToast('Información cargada con éxito!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #downloadPDF(id, numeroConsecutivo) {
    try {
      const json = await this.#apiFetch(`/api/Report/DownloadInvoicePDF?id=${id}`);
      if (!json.Data) { showToast('No se pudo descargar el PDF', 'error'); return; }
      this.#downloadBase64(json.Data, `${numeroConsecutivo}-PDF`, 'application/pdf');
      showToast('Proceso de descarga exitoso!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #viewXML(id) {
    try {
      const json = await this.#apiFetch(`/api/Documents/PrintDocumentXML?docId=${id}`);
      if (!json.Data?.HrRespuestaXml) { showToast('No se encontró respuesta XML', 'error'); return; }
      this.#openBase64InTab(json.Data.HrRespuestaXml, 'application/xml');
      showToast('Información cargada con éxito!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #downloadXML(id, numeroConsecutivo) {
    try {
      const json = await this.#apiFetch(`/api/Documents/DownloadDocumentXML?docId=${id}`);
      if (!json.Data?.HrRespuestaXml) { showToast('No se pudo descargar el XML', 'error'); return; }
      this.#downloadBase64(json.Data.HrRespuestaXml, `${numeroConsecutivo}-XMLRESP`, 'application/xml');
      showToast('Proceso de descarga exitoso!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #downloadDocXML(id, numeroConsecutivo) {
    try {
      const json = await this.#apiFetch(`/api/Documents/GetXMLDoc?docId=${id}`);
      if (!json.Data?.XmlSent) { showToast('No se pudo descargar el XML del documento', 'error'); return; }
      const decoded = this.#b64DecodeUnicode(json.Data.XmlSent);
      const blob = new Blob([decoded], { type: 'application/xml' });
      this.#saveBlob(blob, `${numeroConsecutivo}-XMLDOC`);
      showToast('Proceso de descarga exitoso!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async #skipValidations(docId) {
    this.#openConfirm(
      'Esta acción omitirá las validaciones y enviará el documento a Hacienda con errores bajo su propia responsabilidad',
      '¿Está seguro que desea continuar?',
      async () => {
        try {
          const session = Storage.get('Session') || {};
          await this.#apiFetch('/api/Documents', {
            method: 'PATCH',
            body: JSON.stringify({ docId, feToken: '' }),
          });
          showToast('Estado cambiado con éxito', 'success');
          this.table?.replaceData();
        } catch (err) {
          this.#showErrorModal('Error al omitir validaciones', err.message);
        }
      }
    );
  }

  async #internalCancel(row) {
    const statusLabels = { 1: 'Aceptado', 2: 'Procesando', 3: 'En Hacienda', 4: 'Rechazado', 5: 'Error', 7: 'Anulada Interna' };
    const statusText = statusLabels[row.Status] || 'Desconocido';

    this.#openConfirm(
      `Esta acción anulará de manera interna la FEC bajo su propia responsabilidad, la cuál se encuentra en estado: ${statusText}`,
      '¿Está seguro que desea continuar?',
      async () => {
        try {
          await this.#apiFetch('/api/Documents/SetDocStatusInternalCancelled', {
            method: 'PATCH',
            body: JSON.stringify({ docId: row.Id, feToken: '' }),
          });
          showToast('Documento anulado con éxito', 'success');
          this.table?.replaceData();
        } catch (err) {
          this.#showErrorModal('Error al anular el documento', err.message);
        }
      }
    );
  }

  async #reprocess(docId) {
    if (!this.#hasPerm('Documents_Emission_Reprocess')) {
      showToast('No tiene permiso para realizar esta acción', 'info');
      return;
    }
    try {
      // ApiFEUrl: este endpoint vive en el servidor de sincronización FE, no en el App server
      await this.#apiFetch(
        `/api/Documents/${docId}/Reprocess?isReceptionDocument=false&companyId=${this.#companyId}`,
        { method: 'PATCH', body: JSON.stringify({}), headers: { 'API': 'ApiFEUrl' } }
      );
      showToast('Solicitud de reprocesamiento enviada', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Panel lateral Correos ─────────────────────────────────────────────────

  // Badge para EmailSendType (Tipo del correo)
  #emailTypeBadge(code) {
    const map = {
      1: { label: 'Envío',    bg: '#e8f0fe', color: '#1a56db' },
      2: { label: 'Reenvío',  bg: '#fffbeb', color: '#b45309' },
      3: { label: 'Receptor', bg: '#e8f5ee', color: '#3a7d52' },
    };
    const s = map[Number(code)] ?? { label: String(code ?? ''), bg: '#f3f4f6', color: '#4b5563' };
    return `<span style="background-color:${s.bg}; color:${s.color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${s.label}
    </span>`;
  }

  // Badge para MessageStatus (Estado del correo)
  #emailStatusBadge(code) {
    const map = {
      1: { label: 'Pendiente', bg: '#f3f4f6', color: '#6b7280' },
      2: { label: 'Enviando',  bg: '#e8f0fe', color: '#1a56db' },
      3: { label: 'Error',     bg: '#fdecea', color: '#c0392b' },
      4: { label: 'Enviado',   bg: '#e8f5ee', color: '#3a7d52' },
    };
    const s = map[Number(code)] ?? { label: String(code ?? ''), bg: '#f3f4f6', color: '#4b5563' };
    return `<span style="background-color:${s.bg}; color:${s.color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${s.label}
    </span>`;
  }

  async #openEmailModal(docId) {
    this.#activeEmailDocId = docId;
    this.otherEmailsFormTarget.classList.add('hidden');
    this.inputEmailToTarget.value = '';
    this.inputEmailCCTarget.value = '';

    this.#openEmailPanel();
    this.#setEmailState('loading');

    try {
      const json = await this.#apiFetch(`/api/Email/GetOutgoingMails?docId=${docId}`);

      if (!json.Data?.length) {
        this.#setEmailState('empty');
        return;
      }

      const mails = json.Data.map(m => ({
        ...m,
        CreateDate: m.CreateDate ? m.CreateDate.replace('T', ' ').substring(0, 19) : '',
      }));

      this.#buildEmailTable(mails);
      this.#setEmailState('table');
      showToast('Datos obtenidos con éxito', 'success');
    } catch (err) {
      this.#setEmailState('empty');
      showToast(err.message, 'error');
    }
  }

  // Alterna entre los tres estados visuales del panel de correos
  #setEmailState(state) {
    this.emailLoaderTarget.classList.toggle('hidden', state !== 'loading');
    this.emailTableTarget.classList.toggle('hidden',  state !== 'table');
    this.emailEmptyTarget.classList.toggle('hidden',  state !== 'empty');
    this.#updateResendButton();
  }

  // Habilita Reenviar según el contexto:
  //   - Hay correos en tabla Y el form de otros destinatarios está cerrado
  //   - El form de otros destinatarios está abierto Y tiene al menos un campo con valor válido
  #updateResendButton() {
    const hasTable        = !this.emailTableTarget.classList.contains('hidden');
    const otherEmailsOpen = !this.otherEmailsFormTarget.classList.contains('hidden');
    const toValue         = this.inputEmailToTarget.value.trim();
    const ccValue         = this.inputEmailCCTarget.value.trim();
    const hasRecipient    = toValue.length > 0 || ccValue.length > 0;
    const fieldsValid     = (toValue.length === 0 || this.#isValidEmail(toValue))
                         && (ccValue.length === 0  || this.#isValidEmailList(ccValue));

    const enabled = otherEmailsOpen
      ? hasRecipient && fieldsValid
      : hasTable;

    this.btnResendTarget.disabled = !enabled;
  }

  #openEmailPanel() {
    this.emailPanelBackdropTarget.classList.remove('hidden');
    this.emailModalTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  closeEmailPanel() {
    this.emailModalTarget.classList.add('translate-x-full');
    this.emailPanelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  #buildEmailTable(data) {
    if (this.#emailTabulator) {
      this.#emailTabulator.setData(data);
      return;
    }

    import('tabulator-tables').then(({ TabulatorFull }) => {
      this.#emailTabulator = new TabulatorFull(this.emailTableTarget, {
        data,
        layout: 'fitColumns',
        height: '100%',
        maxHeight: undefined,
        locale: TABULATOR_LOCALE,
        langs: TABULATOR_LANGS,
        pagination: true,
        paginationSize: 5,
        columnDefaults: { headerSort: false },
        columns: [
          { title: 'Fecha',          field: 'CreateDate',  widthGrow: 2 },
          {
            title: 'Estado',
            field: 'Status',
            width: 120,
            formatter: (cell) => this.#emailStatusBadge(cell.getValue()),
          },
          {
            title: 'Estado Doc',
            field: 'DocStatus',
            width: 130,
            formatter: (cell) => this.#statusBadge(this.#statusLabel(Number(cell.getValue()))),
          },
          { title: 'Último intento', field: 'LastAttempt', widthGrow: 1 },
          { title: 'Para',           field: 'OutputTo',    widthGrow: 2 },
          { title: 'CC',             field: 'OutputCC',    widthGrow: 2 },
          {
            title: 'Tipo',
            field: 'Type',
            width: 100,
            formatter: (cell) => this.#emailTypeBadge(cell.getValue()),
          },
          { title: 'Detalles',       field: 'Details',     widthGrow: 3 },
        ],
      });
    });
  }

  onEmailRecipientInput() {
    this.#validateEmailFields();
    this.#updateResendButton();
  }

  // Regex para un correo electrónico individual
  #EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  #isValidEmail(value) {
    return this.#EMAIL_REGEX.test(value.trim());
  }

  #isValidEmailList(value) {
    if (!value.trim()) return true; // vacío es válido (campo opcional)
    return value.split(',').every(e => this.#isValidEmail(e));
  }

  #validateEmailFields() {
    const toValue = this.inputEmailToTarget.value.trim();
    const ccValue = this.inputEmailCCTarget.value.trim();

    // Validar Para — solo si tiene valor
    const toInvalid = toValue.length > 0 && !this.#isValidEmail(toValue);
    this.inputEmailToTarget.classList.toggle('border-red-400', toInvalid);
    this.inputEmailToTarget.classList.toggle('focus:ring-red-400', toInvalid);
    this.errorEmailToTarget.classList.toggle('hidden', !toInvalid);

    // Validar CC — solo si tiene valor
    const ccInvalid = ccValue.length > 0 && !this.#isValidEmailList(ccValue);
    this.inputEmailCCTarget.classList.toggle('border-red-400', ccInvalid);
    this.inputEmailCCTarget.classList.toggle('focus:ring-red-400', ccInvalid);
    this.errorEmailCCTarget.classList.toggle('hidden', !ccInvalid);

    return !toInvalid && !ccInvalid;
  }

  toggleOtherEmails() {
    this.otherEmailsFormTarget.classList.toggle('hidden');
    this.#updateResendButton();
    // Tabulator necesita recalcular su altura cuando el form aparece/desaparece
    requestAnimationFrame(() => this.#emailTabulator?.redraw(true));
  }

  async resendEmail() {
    if (!this.#validateEmailFields()) return;
    try {
      const otherEmails = !this.otherEmailsFormTarget.classList.contains('hidden');
      const mailTo = this.inputEmailToTarget.value.trim();
      const mailCC = this.inputEmailCCTarget.value.trim();

      await this.#apiFetch('/api/Email/', {
        method: 'POST',
        body: JSON.stringify({
          DocId:       this.#activeEmailDocId,
          OtherEmails: otherEmails,
          MailTo:      mailTo,
          MailCC:      mailCC,
        }),
      });
      showToast('Datos listos para el reenvío', 'success');

      // Limpiar campos y refrescar tabla
      this.inputEmailToTarget.value = '';
      this.inputEmailCCTarget.value = '';
      await this.#refreshEmailTable();
    } catch (err) {
      this.#showErrorModal('Error al reenviar correo', err.message);
    }
  }

  async #refreshEmailTable() {
    this.#setEmailState('loading');
    try {
      const json = await this.#apiFetch(`/api/Email/GetOutgoingMails?docId=${this.#activeEmailDocId}`);

      if (!json.Data?.length) {
        this.#setEmailState('empty');
        return;
      }

      const mails = json.Data.map(m => ({
        ...m,
        CreateDate: m.CreateDate ? m.CreateDate.replace('T', ' ').substring(0, 19) : '',
      }));

      this.#emailTabulator?.setData(mails);
      this.#setEmailState('table');
    } catch {
      this.#setEmailState('empty');
    }
  }

  // ── Panel lateral Información ─────────────────────────────────────────────

  async #openInfoModal(row) {
    this.infoClaveTarget.textContent        = row.Clave || '';
    this.infoFechaEmisionTarget.textContent = row.FechaEmision
      ? row.FechaEmision.substring(0, 10)
      : '';

    if (row.ErrDetails) {
      this.infoErrorTarget.textContent = row.ErrDetails;
      this.infoErrorSectionTarget.classList.remove('hidden');
    } else {
      this.infoErrorSectionTarget.classList.add('hidden');
    }

    this.infoErrorHaciendaSectionTarget.classList.add('hidden');
    if (row.Status === 4) {
      try {
        const json = await this.#apiFetch(`/api/Documents/issued/${row.Id}/xml-response-message`);
        if (json.Data?.HrRespuestaXml) {
          this.infoErrorHaciendaTarget.innerHTML = this.#formatHaciendaError(json.Data.HrRespuestaXml);
          this.infoErrorHaciendaSectionTarget.classList.remove('hidden');
        }
      } catch {
        // No bloquear el panel por esto
      }
    }

    this.infoPanelBackdropTarget.classList.remove('hidden');
    this.infoModalTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  async copyClave() {
    const clave = this.infoClaveTarget.textContent.trim();
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
    } catch {
      // Fallback para contextos sin permisos de clipboard
      const ta = document.createElement('textarea');
      ta.value = clave;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    // Mostrar tooltip "¡Copiado!" y ocultarlo tras 1.5s
    this.copyTooltipTarget.classList.remove('hidden');
    clearTimeout(this._copyTooltipTimer);
    this._copyTooltipTimer = setTimeout(() => {
      this.copyTooltipTarget.classList.add('hidden');
    }, 1500);
  }

  closeInfoPanel() {
    this.infoModalTarget.classList.add('translate-x-full');
    this.infoPanelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Modal Chart ────────────────────────────────────────────────────────────

  openChartModal() {
    const q = this.#quantities;
    const values = [
      q[1] || 0, // Aceptado
      q[2] || 0, // Procesando
      q[3] || 0, // En Hacienda
      q[4] || 0, // Rechazado
      q[5] || 0, // Error
      q[7] || 0, // Cancelado
    ];

    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) {
      showToast('No hay datos para mostrar', 'warning');
      return;
    }

    this.chartModalTarget.classList.remove('hidden');

    // Construir/actualizar chart con Chart.js (disponible en CDN)
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.onload = () => this.#renderChart(values);
      document.head.appendChild(script);
    } else {
      this.#renderChart(values);
    }
  }

  #renderChart(values) {
    this.#chart?.destroy();
    const ctx = this.chartCanvasTarget.getContext('2d');
    this.#chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Aceptado', 'Procesando', 'En Hacienda', 'Rechazado', 'Error', 'Anulado'],
        datasets: [{
          data: values,
          backgroundColor: ['#6BBC86', '#1a56db', '#1a56db', '#EC7063', '#FFC300', '#EC7063'],
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  closeChartModal() {
    this.chartModalTarget.classList.add('hidden');
  }

  // ── Descarga Masiva ────────────────────────────────────────────────────────

  bulkDownload() {
    this.#openConfirm(
      'Descarga masiva de documentos',
      'Se creará una solicitud de descarga masiva según los filtros aplicados. Los archivos serán enviados al correo del usuario que ejecuta la acción.',
      async () => {

        try {
          const today = new Date().toISOString().split('T')[0];
          await this.#apiFetch('/api/Report/BulkDownloadOfDocuments/', {
            method: 'POST',
            body: JSON.stringify({
              Id: 0,
              CreationDate: today,
              UserId: '',
              StartDate: this.inputStartDateTarget.value,
              EndDate: this.inputEndDateTarget.value,
              CompanyId: this.#companyId,
              DocType: 1,
              Status: 0,
              AttemptsToSend: 0,
              LastAttempt: null,
              UseXMLDate: false,
              KindOfDocuments: '01',
              ToEmail: '',
              CCEmail: '',
            }),
          });
          showToast('Solicitud creada con éxito!!!', 'success');
        } catch (err) {
          this.#showErrorModal('Error al crear solicitud de descarga masiva', err.message);
        }
      },
      'info'
    );
  }

  // ── Formulario handlers ────────────────────────────────────────────────────

  search() {
    this.btnChartTarget.classList.add('hidden');
    // setPage(1) dispara ajaxRequestFunc automáticamente con page=1 y el size actual
    this.table?.setPage(1);
  }

  setTodayStartDate() {
    this.inputStartDateTarget.value = this.#todayISO();
  }

  setTodayEndDate() {
    this.inputEndDateTarget.value = this.#todayISO();
  }

  // ── Modal Confirmación ────────────────────────────────────────────────────

  #openConfirm(title, subtitle, callback, type = 'warning') {
    this.confirmTitleTarget.textContent    = title;
    this.confirmSubtitleTarget.textContent = subtitle;
    this.#confirmCallback = callback;

    const iconMap = {
      warning: { icon: 'warning',     color: 'text-amber-500' },
      info:    { icon: 'info',         color: 'text-blue-500'  },
      danger:  { icon: 'error',        color: 'text-red-500'   },
    };
    const { icon, color } = iconMap[type] ?? iconMap.warning;
    this.confirmIconTarget.textContent = icon;
    this.confirmIconTarget.className   = `material-icons text-2xl ${color}`;

    this.confirmModalTarget.classList.remove('hidden');
  }

  acceptConfirm() {
    this.confirmModalTarget.classList.add('hidden');
    if (this.#confirmCallback) {
      this.#confirmCallback();
      this.#confirmCallback = null;
    }
  }

  cancelConfirm() {
    this.confirmModalTarget.classList.add('hidden');
    this.#confirmCallback = null;
  }

  // ── Modal Error ───────────────────────────────────────────────────────────

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  // ── Contadores de estado ──────────────────────────────────────────────────

  #renderStatusCounters() {
    const configs = [
      { status: 1, label: 'Aceptado',    bg: '#e8f5ee', color: '#3a7d52' },
      { status: 2, label: 'Procesando',  bg: '#e8f0fe', color: '#1a56db' },
      { status: 3, label: 'En Hacienda', bg: '#e8f0fe', color: '#1a56db' },
      { status: 4, label: 'Rechazado',   bg: '#fdecea', color: '#c0392b' },
      { status: 5, label: 'Error',       bg: '#fffbeb', color: '#b45309' },
      { status: 6, label: 'Reprocesar',  bg: '#fff7ed', color: '#c2410c' },
      { status: 7, label: 'Anulado',     bg: '#fdecea', color: '#c0392b' },
    ];

    this.statusCountersTarget.innerHTML = configs
      .filter(c => (this.#quantities[c.status] || 0) > 0)
      .map(c => `
        <span style="background-color:${c.bg}; color:${c.color};"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
          ${c.label}: ${this.#quantities[c.status]}
        </span>`)
      .join('');
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

  #formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  #openBase64InTab(b64, mimeType) {
    const binary   = atob(b64);
    const len      = binary.length;
    const buf      = new ArrayBuffer(len);
    const view     = new Uint8Array(buf);
    for (let i = 0; i < len; i++) view[i] = binary.charCodeAt(i);
    const blob     = new Blob([view], { type: mimeType });
    const url      = URL.createObjectURL(blob);
    const tab      = window.open();
    if (tab) tab.location.href = url;
  }

  #downloadBase64(b64, fileName, mimeType) {
    const binary   = atob(b64);
    const len      = binary.length;
    const buf      = new ArrayBuffer(len);
    const view     = new Uint8Array(buf);
    for (let i = 0; i < len; i++) view[i] = binary.charCodeAt(i);
    const blob = new Blob([view], { type: mimeType });
    this.#saveBlob(blob, fileName);
  }

  #saveBlob(blob, fileName) {
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  #b64DecodeUnicode(str) {
    return decodeURIComponent(
      atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
  }

  // ── Tooltip para opciones inhabilitadas del dropdown ──────────────────────

  #showDropdownTooltip(event, text) {
    let tip = document.getElementById('cl-dropdown-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'cl-dropdown-tooltip';
      tip.style.cssText = 'position:fixed;z-index:10000;background:#1f2937;color:#fff;font-size:12px;line-height:1.5;border-radius:8px;padding:8px 12px;max-width:220px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.25);';
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    const rect = event.target.getBoundingClientRect();
    tip.style.left = `${rect.right + 8}px`;
    tip.style.top  = `${rect.top + rect.height / 2 - 12}px`;
  }

  #hideDropdownTooltip() {
    const tip = document.getElementById('cl-dropdown-tooltip');
    if (tip) tip.style.display = 'none';
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

    // Parsear entradas: código, ""mensaje"", fila, columna
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
}
