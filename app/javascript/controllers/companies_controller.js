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
 *   - Columnas: Nombre Legal, Nombre Comercial, Identificación, Favorita (star), Estado (badge), Acciones
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
    'btnCreate',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ─────────────────────────────────────────────────────────

  #permissions = [];        // string[]
  #pendingFavoriteId = null;
  #totalRecords = 0;        // total real del servidor (evita sobreestimación de Tabulator)

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    this.#permissions = SStore.get('Permissions') || [];

    if (this.#hasPerm('F_CreateCompany')) {
      this.btnCreateTarget.classList.remove('hidden');
      this.btnCreateTarget.classList.add('inline-flex');
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
      paginationSize: 5,
      paginationSizeSelector: [5, 10, 15],
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
        title: 'Compañía Favorita', field: 'Favorite', width: 160, hozAlign: 'center',
        formatter: (cell) => cell.getValue()
          ? '<span class="material-icons" style="color:#FFC107;">star</span>'
          : '',
      },
      {
        title: 'Estado', field: 'Active', width: 110,
        formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
      },
      {
        title: 'Acciones', field: 'Id', width: 110, hozAlign: 'center',
        formatter: () => this.#actionButtons(),
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
    window.location.href = '/configurations/companies/new';
  }

  // ── Event handlers de fila ─────────────────────────────────────────────────

  async #onFavoriteClick(company) {
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
    window.location.href = `/configurations/companies/${company.Id}/edit`;
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

  #actionButtons() {
    const btn = (icon, tooltip, type) => `
      <button type="button" data-action-type="${type}" data-tooltip="${tooltip}"
              class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
        <span class="material-icons text-base">${icon}</span>
      </button>`;
    return `<div class="flex items-center justify-center gap-1">${btn('star', 'Establecer como Favorita', 'favorite')}${btn('edit', 'Actualizar', 'edit')}</div>`;
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  /** Permissions es string[] — e.g. ["F_CreateCompany", "S_Company"] */
  #hasPerm(name) {
    return this.#permissions.includes(name);
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
