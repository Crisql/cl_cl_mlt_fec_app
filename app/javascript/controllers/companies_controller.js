import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES, confirm } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * CompaniesController — Búsqueda y listado paginado de compañías (Tabulator).
 *
 * Replica: Angular CompanyComponent
 *   - GET api/Companies/GetCompanies (paginado server-side)
 *   - Tabla Tabulator con paginación REMOTA (StartPos/StepPos + MaxQtyRowsFetch)
 *   - Columnas: Nombre Legal, Nombre Comercial, Identificación, Estado (badge), Acciones (estrella favorita + editar)
 *   - "Consultar" → resetea a página 1 y recarga
 *   - "Crear" → navega a /new (permiso F_CreateCompany)
 *   - Favorita (star) con confirmación previa · Actualizar (edit, permiso F_ModifyCompany)
 *
 * Layout full-height: height "100%"; el paginador de Tabulator queda al pie y las filas
 * hacen scroll interno solo cuando se requiere.
 *
 * Storage (ver fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session          → { access_token, ... }
 *   - sessionStorage.CurrentCompany → { companyId, companyName, groupId, ... }
 *   - sessionStorage.Permissions    → string[]
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    'searchLegalName',
    'searchComercialName',
    'searchIdentification',
    'btnCreate', 'btnCreateWrap',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ─────────────────────────────────────────────────────────

  #permissions = [];        // string[]
  #pendingFavoriteId = null;
  #totalRecords = 0;        // total real del servidor (evita sobreestimación de Tabulator)

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    this.#permissions = SStore.get('Permissions') || [];

    // Botón "Nueva Compañía": habilitado solo con permiso; si no, queda
    // deshabilitado con tooltip explicativo (ver CLAUDE.md §26).
    if (this.#hasPerm('F_CreateCompany')) {
      this.#enableCreateButton();
    } else if (this.hasBtnCreateWrapTarget) {
      this.#attachTooltip(this.btnCreateWrapTarget);
    }

    super.connect();   // construye la tabla y dispara la carga remota de la página 1
  }

  // ── Configuración Tabulator (paginación remota) ──────────────────────────────

  getTableConfig() {
    return {
      height: '100%',
      layout: 'fitColumns',
      movableRows: false,
      placeholder: 'No se encontraron compañías',
      columnDefaults: { headerSort: false },

      // Paginación server-side
      pagination: true,
      paginationMode: 'remote',
      paginationSize: 10,
      paginationSizeSelector: [10, 15, 25],
      // paginationCounter custom — Tabulator calcula el total como last_page*pageSize, lo que
      // sobreestima cuando la última página no está llena. Usamos el total real del servidor.
      paginationCounter: (_pageSize, currentRow, _currentPage, _totalRows, _totalPages) => {
        const total = this.#totalRecords;
        if (!total) return '';
        const to = Math.min(currentRow + _pageSize - 1, total);
        return `Mostrando ${currentRow.toLocaleString('es-CR')}-${to.toLocaleString('es-CR')} de ${total.toLocaleString('es-CR')} filas`;
      },
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      ajaxURL: '/api/Companies/GetCompanies',
      ajaxRequestFunc: (url, config, params) => this.#fetchPage(url, params),

      columns: this.getColumns(),
    };
  }

  getColumns() {
    return [
      { title: 'Nombre Legal', field: 'EmsrNombre', widthGrow: 2 },
      { title: 'Nombre Comercial', field: 'EmsrNombreComercial', widthGrow: 2 },
      { title: 'Identificación', field: 'EmsrIdeNumero', widthGrow: 1 },
      {
        title: 'Estado', field: 'Active', width: 110,
        formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
      },
      {
        title: 'Acciones', field: 'Id', width: 110, hozAlign: 'center',
        formatter: (cell) => this.#actionButtons(cell.getRow().getData()),
        cellClick: (e, cell) => {
          const row = cell.getRow().getData();
          if (e.target.closest('[data-action-type="favorite"]')) this.#onFavoriteClick(row);
          else if (e.target.closest('[data-action-type="edit"]')) this.#onEditClick(row);
        },
      },
    ];
  }

  /**
   * Función de carga remota para Tabulator.
   * @param {string} url       ajaxURL configurada
   * @param {Object} params    { page (1-indexed), size, ... }
   * @returns {Promise<{data: Array, last_page: number}>}
   */
  async #fetchPage(url, params) {
    const page = params.page || 1;
    const size = params.size || 5;

    const qp = new URLSearchParams({
      LegalName:         this.searchLegalNameTarget.value.trim(),
      ComercialName:     this.searchComercialNameTarget.value.trim(),
      Identification:    this.searchIdentificationTarget.value.trim(),
      StartPos:          String(page),
      StepPos:           String(size),
      RequirePagination: 'true',
      status:            '',
    });

    try {
      const json = await this.#apiFetch(`${url}?${qp}`);

      if (json.Error || !json.Data) {
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Se produjo un error al obtener información de Compañías', message: json.Message || 'Error desconocido' });
        return { data: [], last_page: 1 };
      }

      const total    = json.Data[0]?.MaxQtyRowsFetch || 0;
      this.#totalRecords = total;
      const lastPage = Math.max(1, Math.ceil(total / size));
      return { data: json.Data, last_page: lastPage };
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Se produjo un error al obtener las compañías', message: err.message });
      return { data: [], last_page: 1 };
    }
  }

  // ── Acciones públicas ──────────────────────────────────────────────────────

  search() {
    // setData() recarga vía ajax y vuelve a la página 1
    this.table.setData();
  }

  navigateCreate() {
    Turbo.visit('/configurations/companies/new');
  }

  // ── Event handlers de fila ─────────────────────────────────────────────────

  async #onFavoriteClick(company) {
    if (company.Favorite) return;
    if ((company.QtyRolAssign ?? 1) === 0) {
      showToast('Opción no disponible, ya que no posee asignaciones.', 'info');
      return;
    }
    const confirmed = await confirm('¿Está seguro de que desea cambiar la compañía favorita?', 'Compañía favorita', ALERT_TYPES.QUESTION);
    if (!confirmed) return;

    try {
      const json = await this.#apiFetch(`/api/companies/${company.Id}/favorite`, { method: 'POST' });
      if (json.Error) {
        showToast(`Error al cambiar la compañía favorita. ${json.Message}`, 'error');
      } else {
        showToast('Compañía favorita cambiada con éxito', 'success');
        this.table.replaceData();
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  #onEditClick(company) {
    if (!this.#hasPerm('F_ModifyCompany')) {
      showToast('Opción no disponible, ya que no posee los permisos.', 'info');
      return;
    }
    Turbo.visit(`/configurations/companies/${company.Id}/edit`);
  }

  // ── Render helpers (formatters Tabulator) ────────────────────────────────────

  #statusBadge(status) {
    const map = {
      active:   { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'   },
      inactive: { bg: '#fdecea', color: '#c0392b', label: 'Inactivo' },
    };
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    return `<span style="background-color:${bg}; color:${color};" class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">${label}</span>`;
  }

  #actionButtons(row = {}) {
    const isFavorite = !!row.Favorite;
    const starStyle  = isFavorite
      ? 'color:#FFC107;'
      : 'color:transparent; -webkit-text-stroke:1.5px #9ca3af;';
    const starTip    = isFavorite ? 'Compañía favorita' : 'Establecer como favorita';
    const starBtn    = `
      <button type="button" data-action-type="favorite" data-tooltip="${starTip}"
              class="p-1.5 rounded transition-colors ${isFavorite ? 'cursor-default' : 'hover:bg-yellow-50 cursor-pointer'}">
        <span class="material-icons text-base" style="${starStyle}">star</span>
      </button>`;
    // Editar: deshabilitado con tooltip si no tiene permiso (ver CLAUDE.md §26).
    // El data-tooltip va en el <span> envolvente porque un <button disabled> no
    // emite eventos de mouse; el setupTooltip base (tabla) lo detecta ahí.
    const editBtn = this.#hasPerm('F_ModifyCompany')
      ? `<button type="button" data-action-type="edit" data-tooltip="Editar"
                 class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
           <span class="material-icons text-base">edit</span>
         </button>`
      : `<span data-tooltip="No cuenta con permisos para editar compañías">
           <button type="button" disabled
                   class="p-1.5 text-gray-300 rounded cursor-not-allowed pointer-events-none">
             <span class="material-icons text-base">edit</span>
           </button>
         </span>`;
    return `<div class="flex items-center justify-center gap-1">${starBtn}${editBtn}</div>`;
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  /** Permissions es string[] — e.g. ["F_CreateCompany", "S_Company"] */
  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  // Habilita el botón "Nueva Compañía" (nace deshabilitado/gris con tooltip de
  // "sin permisos" en su <span> envolvente). Ver CLAUDE.md §26.
  #enableCreateButton() {
    const btn = this.btnCreateTarget;
    btn.disabled = false;
    btn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed', 'pointer-events-none');
    btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
    if (this.hasBtnCreateWrapTarget) this.btnCreateWrapTarget.removeAttribute('data-tooltip');
  }

  // Tooltip flotante scoped a un elemento del toolbar (fuera de la tabla, que el
  // setupTooltip base no cubre). Reposiciona dentro del viewport. Ver CLAUDE.md §25/§26.
  #attachTooltip(el) {
    let tip = document.getElementById('cl-tabulator-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'cl-tabulator-tooltip';
      tip.style.cssText = [
        'position:fixed', 'z-index:9999', 'pointer-events:none',
        'background:#1f2937', 'color:#fff', 'padding:4px 8px',
        'border-radius:4px', 'font-size:12px', 'line-height:1.35',
        'max-width:min(320px, calc(100vw - 16px))',
        'white-space:normal', 'word-break:break-word', 'text-align:left',
        'opacity:0', 'transition:opacity 0.15s',
      ].join(';');
      document.body.appendChild(tip);
    }

    const place = (e) => {
      const margin = 8;
      const { width: w, height: h } = tip.getBoundingClientRect();
      let left = e.clientX + 12;
      let top  = e.clientY - h - 10;
      if (left + w + margin > window.innerWidth) left = e.clientX - w - 12;
      if (left < margin) left = margin;
      if (left + w + margin > window.innerWidth) left = window.innerWidth - w - margin;
      if (top < margin) top = e.clientY + 18;
      if (top + h + margin > window.innerHeight) top = window.innerHeight - h - margin;
      tip.style.left = left + 'px';
      tip.style.top  = top + 'px';
    };

    el.addEventListener('mouseenter', (e) => {
      if (!el.dataset.tooltip) return;
      tip.textContent = el.dataset.tooltip;
      place(e);
      tip.style.opacity = '1';
    });
    el.addEventListener('mousemove', (e) => {
      if (tip.style.opacity === '1') place(e);
    });
    el.addEventListener('mouseleave', () => {
      tip.style.opacity = '0';
    });
  }

  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {};
    const token   = session.access_token;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type':             'application/json',
        'API':                      'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
