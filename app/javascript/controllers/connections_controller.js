import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * ConnectionsController — Lista y búsqueda de conexiones SAP (Tabulator).
 *
 * Replica: Angular ConnectionsComponent
 *   - GET /api/Connections?server=&apiUrl= (paginado vía headers)
 *   - Headers de paginación: cl-dba-pagination-page (0-indexed), cl-dba-pagination-page-size
 *   - Total de registros en header: cl-dba-pagination-records-count
 *   - Tabla Tabulator con paginación REMOTA
 *   - Columnas: ID, Servidor, Usuario, Motor de base de datos, URL API, URL Crystal API, Acciones
 *   - "Crear" → visible si permiso Configurations_Connections_Create
 *   - "Editar" por fila → visible si permiso Configurations_Connections_Update
 *
 * Layout full-height: height "100%"; paginador al pie y scroll interno de filas
 * solo cuando se requiere.
 *
 * Storage (fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session          → { access_token, ... }
 *   - sessionStorage.Permissions    → string[]
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    'inputServer',
    'inputApiUrl',
    'btnCreate',
    'errorModal',
    'errorTitle',
    'errorSubtitle',
  ];

  static values = { ...TabulatorController.values };

  #permissions = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    const perms = SStore.get('Permissions');
    this.#permissions = Array.isArray(perms) ? perms : [];

    if (this.#hasPerm('Configurations_Connections_Create')) {
      this.btnCreateTarget.classList.remove('hidden');
    }

    super.connect();   // construye la tabla y dispara la carga remota de la página 1
  }

  // ── Configuración Tabulator (paginación remota) ──────────────────────────────

  getTableConfig() {
    return {
      height: '100%',
      layout: 'fitColumns',
      movableRows: false,
      placeholder: 'No hay conexiones registradas',
      columnDefaults: { headerSort: false },

      pagination: true,
      paginationMode: 'remote',
      paginationSize: 5,
      paginationSizeSelector: [5, 10, 15],
      paginationCounter: 'rows',
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      ajaxURL: '/api/Connections',
      ajaxRequestFunc: (url, config, params) => this.#fetchPage(url, params),

      columns: this.getColumns(),
    };
  }

  getColumns() {
    const canEdit = this.#hasPerm('Configurations_Connections_Update');

    const columns = [
      { title: 'ID', field: 'Id', width: 80 },
      { title: 'Servidor', field: 'Server', widthGrow: 1 },
      { title: 'Usuario', field: 'DBUser', widthGrow: 1 },
      { title: 'Motor de base de datos', field: 'DBEngine', widthGrow: 1 },
      { title: 'URL API', field: 'APIUrl', widthGrow: 2, tooltip: true },
      { title: 'URL Crystal API', field: 'CrystalAPIUrl', widthGrow: 2, tooltip: true },
    ];

    if (canEdit) {
      columns.push({
        title: 'Acciones', field: 'Id', width: 100, hozAlign: 'center', headerSort: false,
        formatter: () => this.#editButton(),
        cellClick: (e, cell) => {
          if (e.target.closest('[data-action-type="edit"]')) {
            this.#onEditClick(cell.getRow().getData());
          }
        },
      });
    }

    return columns;
  }

  /**
   * Función de carga remota para Tabulator.
   * La API pagina por headers (página 0-indexed) y devuelve el total en
   * el header cl-dba-pagination-records-count.
   * @param {string} url     ajaxURL configurada
   * @param {Object} params  { page (1-indexed), size, ... }
   * @returns {Promise<{data: Array, last_page: number}>}
   */
  async #fetchPage(url, params) {
    const size = params.size || 5;
    const apiPage = (params.page || 1) - 1;   // la API es 0-indexed

    const qp = new URLSearchParams({
      server: this.inputServerTarget.value.trim(),
      apiUrl: this.inputApiUrlTarget.value.trim(),
    });

    try {
      const { json, headers } = await this.#apiFetch(`${url}?${qp}`, {
        headers: {
          'cl-dba-pagination-page':      String(apiPage),
          'cl-dba-pagination-page-size': String(size),
        },
      });

      if (json.Error || !json.Data) {
        showToast(json.Message || 'Error al obtener las conexiones', 'error');
        return { data: [], last_page: 1 };
      }

      const total    = parseInt(headers.get('cl-dba-pagination-records-count') ?? '0') || json.Data.length;
      const lastPage = Math.max(1, Math.ceil(total / size));
      return { data: json.Data, last_page: lastPage };
    } catch (err) {
      showToast(err.message || 'Error al obtener las conexiones', 'error');
      return { data: [], last_page: 1 };
    }
  }

  // ── Acciones públicas ──────────────────────────────────────────────────────

  search() {
    this.table.setData();   // recarga vía ajax y vuelve a la página 1
  }

  goToNew() {
    window.location.href = '/configurations/connections/new';
  }

  #onEditClick(conn) {
    if (!this.#hasPerm('Configurations_Connections_Update')) {
      showToast('No cuenta con permisos para realizar esta acción.', 'info');
      return;
    }
    window.location.href = `/configurations/connections/${conn.Id}/edit`;
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  #editButton() {
    return `
      <div class="relative group inline-block">
        <button type="button" data-action-type="edit"
                class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
          <span class="material-icons text-base">edit</span>
        </button>
        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                     whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white
                     opacity-0 group-hover:opacity-100 transition-opacity z-10">Editar</span>
      </div>`;
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

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

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return { json, headers: response.headers };
  }
}
