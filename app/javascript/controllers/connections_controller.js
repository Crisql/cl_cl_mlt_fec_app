import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';

/**
 * ConnectionsController — Lista y búsqueda de conexiones SAP.
 *
 * Replica: Angular ConnectionsComponent
 *
 * Funcionalidad:
 *   - GET /api/Connections?server=&apiUrl= (paginado vía headers)
 *   - Headers de paginación: cl-dba-pagination-page (0-indexed), cl-dba-pagination-page-size
 *   - Tabla: ID, Servidor, Usuario, Motor de base de datos, URL API, URL Crystal API
 *   - Paginación server-side: 5/10/15 por página
 *   - Botón "Crear" → visible si permiso Configurations_Connections_Create
 *   - Botón "Editar" por fila → visible si permiso Configurations_Connections_Update
 *
 * Storage (fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session          → { access_token, ... }
 *   - sessionStorage.Permissions    → string[]
 */
export default class extends Controller {
  static targets = [
    'inputServer',
    'inputApiUrl',
    'btnCreate',
    'table',
    'tbody',
    'emptyState',
    'loadingState',
    'pagination',
    'pageSizeSelect',
    'pageInfo',
    'prevBtn',
    'nextBtn',
    'errorModal',
    'errorTitle',
    'errorSubtitle',
  ];

  #connections  = [];
  #currentPage  = 0;
  #itemsPerPage = 5;
  #totalRecords = 0;
  #permissions  = [];

  connect() {
    this.#onLoad();
  }

  #onLoad() {
    const perms = SStore.get('Permissions');
    this.#permissions = Array.isArray(perms) ? perms : [];

    if (this.#hasPerm('Configurations_Connections_Create')) {
      this.btnCreateTarget.classList.remove('hidden');
    }

    this.#loadConnections();
  }

  async #loadConnections() {
    const server = this.inputServerTarget.value.trim();
    const apiUrl = this.inputApiUrlTarget.value.trim();

    this.#setLoading(true);
    try {
      const params = new URLSearchParams({ server, apiUrl });
      const { json, headers } = await this.#apiFetch(`/api/Connections?${params}`, {
        headers: {
          'cl-dba-pagination-page':      String(this.#currentPage),
          'cl-dba-pagination-page-size': String(this.#itemsPerPage),
        },
      });

      if (json.Error || !json.Data) {
        showToast(json.Message || 'Error al obtener las conexiones', 'error');
        return;
      }

      this.#connections  = json.Data;
      this.#totalRecords = parseInt(headers.get('cl-dba-pagination-records-count') ?? '0') || json.Data.length;
      this.#renderTable();
    } catch (err) {
      showToast(err.message || 'Error al obtener las conexiones', 'error');
    } finally {
      this.#setLoading(false);
    }
  }

  #renderTable() {
    if (this.#connections.length === 0) {
      this.tbodyTarget.innerHTML = '';
      this.emptyStateTarget.classList.remove('hidden');
      this.paginationTarget.classList.add('hidden');
      return;
    }

    this.emptyStateTarget.classList.add('hidden');
    this.tbodyTarget.innerHTML = this.#connections.map(c => this.#rowHTML(c)).join('');
    this.#renderPagination();
  }

  #renderPagination() {
    if (!this.#totalRecords) {
      this.paginationTarget.classList.add('hidden');
      return;
    }

    this.paginationTarget.classList.remove('hidden');

    const totalPages = Math.max(1, Math.ceil(this.#totalRecords / this.#itemsPerPage));
    const from       = this.#currentPage * this.#itemsPerPage + 1;
    const to         = Math.min((this.#currentPage + 1) * this.#itemsPerPage, this.#totalRecords);

    this.pageInfoTarget.textContent = `${from}–${to} de ${this.#totalRecords}`;
    this.prevBtnTarget.disabled     = this.#currentPage === 0;
    this.nextBtnTarget.disabled     = this.#currentPage >= totalPages - 1;
  }

  #rowHTML(conn) {
    const canEdit = this.#hasPerm('Configurations_Connections_Update');

    const editBtn = canEdit
      ? `<div class="relative group inline-block">
           <button type="button"
                   data-testid="btn-edit-${conn.Id}"
                   data-action="click->connections#onEditClick"
                   data-connection-id="${conn.Id}"
                   class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
             <span class="material-icons text-base">edit</span>
           </button>
           <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                        whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white
                        opacity-0 group-hover:opacity-100 transition-opacity z-10">
             Editar
           </span>
         </div>`
      : '';

    return `
      <tr data-testid="connection-row-${conn.Id}"
          class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">${this.#esc(String(conn.Id))}</td>
        <td class="px-4 py-3">${this.#esc(conn.Server ?? '')}</td>
        <td class="px-4 py-3">${this.#esc(conn.DBUser ?? '')}</td>
        <td class="px-4 py-3">${this.#esc(conn.DBEngine ?? '')}</td>
        <td class="px-4 py-3 max-w-[200px] truncate" title="${this.#esc(conn.APIUrl ?? '')}">${this.#esc(conn.APIUrl ?? '')}</td>
        <td class="px-4 py-3 max-w-[180px] truncate" title="${this.#esc(conn.CrystalAPIUrl ?? '')}">${this.#esc(conn.CrystalAPIUrl ?? '')}</td>
        <td class="px-4 py-3">${editBtn}</td>
      </tr>
    `;
  }

  search() {
    this.#currentPage = 0;
    this.#loadConnections();
  }

  onPageSizeChange() {
    this.#itemsPerPage = parseInt(this.pageSizeSelectTarget.value);
    this.#currentPage  = 0;
    this.#loadConnections();
  }

  prevPage() {
    if (this.#currentPage > 0) {
      this.#currentPage--;
      this.#loadConnections();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.#totalRecords / this.#itemsPerPage);
    if (this.#currentPage < totalPages - 1) {
      this.#currentPage++;
      this.#loadConnections();
    }
  }

  goToNew() {
    window.location.href = '/configurations/connections/new';
  }

  onEditClick(event) {
    if (!this.#hasPerm('Configurations_Connections_Update')) {
      showToast('No cuenta con permisos para realizar esta acción.', 'info');
      return;
    }
    const id = event.currentTarget.dataset.connectionId;
    window.location.href = `/configurations/connections/${id}/edit`;
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  #setLoading(loading) {
    this.loadingStateTarget.classList.toggle('hidden', !loading);
    if (loading) {
      this.tbodyTarget.innerHTML = '';
      this.emptyStateTarget.classList.add('hidden');
      this.paginationTarget.classList.add('hidden');
    }
  }

  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  #esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
