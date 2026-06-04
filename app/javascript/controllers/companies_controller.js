import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';

/**
 * CompaniesController — Búsqueda y listado paginado de compañías.
 *
 * Replica: Angular CompanyComponent
 *   - GET api/Companies/GetCompanies (paginado)
 *   - Tabla: Nombre Legal, Nombre Comercial, Identificación, Favorita (star), Activa (badge)
 *   - Botón "Consultar" → resetea página a 0 y recarga
 *   - Botón "Crear" → navega a /new (permiso F_CreateCompany)
 *   - Por fila: Favorita (star) + Actualizar (edit)
 *   - POST api/companies/{id}/favorite → confirmación previa
 *   - Paginación: 5/10/15 por página, server-side
 *
 * Storage (ver fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session         → { access_token, expires_at, ... }
 *   - sessionStorage.CurrentCompany → { companyId, companyName, groupId, ... }
 *   - sessionStorage.Permissions    → string[]  (e.g. ["F_CreateCompany", "S_Company"])
 */
export default class extends Controller {
  static targets = [
    'searchLegalName',
    'searchComercialName',
    'searchIdentification',
    'btnCreate',
    'table',
    'tbody',
    'emptyState',
    'loadingState',
    'pagination',
    'pageSizeSelect',
    'pageInfo',
    'currentPage',
    'prevBtn',
    'nextBtn',
    'confirmModal',
    'errorModal',
    'errorTitle',
    'errorSubtitle',
    'toast',
    'toastIcon',
    'toastMessage',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  #companies    = [];
  #currentPage  = 0;   // 0-indexed internamente; se envía +1 a la API
  #itemsPerPage = 5;
  #totalRecords = 0;
  #pendingFavoriteId = null;

  #companyId   = null;
  #permissions = [];   // string[] — e.g. ["F_CreateCompany", "F_ModifyCompany"]

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    this.#onLoad();
  }

  // ── Inicialización ─────────────────────────────────────────────────────────

  #onLoad() {
    const company = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    // Permissions es array de strings en sessionStorage
    this.#permissions = SStore.get('Permissions') || [];

    if (this.#hasPerm('F_CreateCompany')) {
      this.btnCreateTarget.classList.remove('hidden');
      this.btnCreateTarget.classList.add('inline-flex');
    }

    this.#loadCompanies();
  }

  // ── Acciones públicas ──────────────────────────────────────────────────────

  search() {
    this.#currentPage = 0;
    this.#loadCompanies();
  }

  navigateCreate() {
    window.location.href = '/configurations/companies/new';
  }

  onPageSizeChange() {
    this.#itemsPerPage = parseInt(this.pageSizeSelectTarget.value);
    this.#currentPage  = 0;
    this.#loadCompanies();
  }

  prevPage() {
    if (this.#currentPage > 0) {
      this.#currentPage--;
      this.#loadCompanies();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.#totalRecords / this.#itemsPerPage);
    if (this.#currentPage < totalPages - 1) {
      this.#currentPage++;
      this.#loadCompanies();
    }
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  cancelFavorite() {
    this.#pendingFavoriteId = null;
    this.confirmModalTarget.classList.add('hidden');
  }

  async confirmFavorite() {
    this.confirmModalTarget.classList.add('hidden');
    if (!this.#pendingFavoriteId) return;

    const id = this.#pendingFavoriteId;
    this.#pendingFavoriteId = null;

    try {
      const json = await this.#apiFetch(`/api/companies/${id}/favorite`, { method: 'POST' });
      if (json.Error) {
        this.#showToast('error', `Error al cambiar la compañía favorita. ${json.Message}`);
      } else {
        this.#showToast('success', 'Compañía favorita cambiada con éxito');
        this.#loadCompanies();
      }
    } catch (err) {
      this.#showToast('error', `Error: ${err.message}`);
    }
  }

  // ── API ────────────────────────────────────────────────────────────────────

  async #loadCompanies() {
    this.#setLoading(true);

    const legalName      = this.searchLegalNameTarget.value.trim();
    const comercialName  = this.searchComercialNameTarget.value.trim();
    const identification = this.searchIdentificationTarget.value.trim();

    const params = new URLSearchParams({
      LegalName:         legalName,
      ComercialName:     comercialName,
      Identification:    identification,
      StartPos:          String(this.#currentPage + 1),
      StepPos:           String(this.#itemsPerPage),
      RequirePagination: 'true',
      status:            '',
    });

    try {
      const json = await this.#apiFetch(`/api/Companies/GetCompanies?${params}`);

      if (json.Error || !json.Data) {
        this.#showErrorModal(
          'Se produjo un error al obtener información de Compañías',
          json.Message || 'Error desconocido'
        );
        this.#companies = [];
        this.#renderTable();
        return;
      }

      this.#companies    = json.Data;
      this.#totalRecords = json.Data[0]?.MaxQtyRowsFetch || 0;
      this.#renderTable();
    } catch (err) {
      this.#showErrorModal('Se produjo un error al obtener las compañías', err.message);
      this.#companies = [];
      this.#renderTable();
    } finally {
      this.#setLoading(false);
    }
  }

  // ── Renderizado ────────────────────────────────────────────────────────────

  #renderTable() {
    const tbody = this.tbodyTarget;
    tbody.innerHTML = '';

    if (!this.#companies.length) {
      this.emptyStateTarget.classList.remove('hidden');
      this.paginationTarget.classList.add('hidden');
      return;
    }

    this.emptyStateTarget.classList.add('hidden');

    this.#companies.forEach(company => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-800">${this.#esc(company.EmsrNombre)}</td>
        <td class="px-4 py-3 text-gray-700">${this.#esc(company.EmsrNombreComercial)}</td>
        <td class="px-4 py-3 text-gray-700">${this.#esc(company.EmsrIdeNumero)}</td>
        <td class="px-4 py-3 text-center" data-testid="favorite-cell">
          ${company.Favorite
            ? '<span class="material-icons" style="color:#FFC107;">star</span>'
            : ''}
        </td>
        <td class="px-4 py-3" data-testid="status-badge">
          ${this.#statusBadge(company.Active ? 'active' : 'inactive')}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            ${this.#actionBtn('star', 'Establecer como Favorita', 'favorite', company.Id)}
            ${this.#actionBtn('edit', 'Actualizar', 'edit', company.Id)}
          </div>
        </td>
      `;

      tr.querySelector('[data-action-type="favorite"]')
        .addEventListener('click', () => this.#onFavoriteClick(company));
      tr.querySelector('[data-action-type="edit"]')
        .addEventListener('click', () => this.#onEditClick(company));

      tbody.appendChild(tr);
    });

    this.#renderPagination();
  }

  #renderPagination() {
    if (!this.#totalRecords) {
      this.paginationTarget.classList.add('hidden');
      return;
    }

    this.paginationTarget.classList.remove('hidden');

    const totalPages = Math.max(1, Math.ceil(this.#totalRecords / this.#itemsPerPage));
    const page       = this.#currentPage;
    const from       = page * this.#itemsPerPage + 1;
    const to         = Math.min((page + 1) * this.#itemsPerPage, this.#totalRecords);

    this.pageInfoTarget.textContent    = `${from}–${to} de ${this.#totalRecords}`;
    this.currentPageTarget.textContent = String(page + 1);
    this.prevBtnTarget.disabled        = page === 0;
    this.nextBtnTarget.disabled        = page >= totalPages - 1;
  }

  // ── Event handlers de fila ─────────────────────────────────────────────────

  #onFavoriteClick(company) {
    if ((company.QtyRolAssign ?? 1) === 0) {
      this.#showToast('info', 'Opción no disponible, ya que no posee asignaciones.');
      return;
    }
    this.#pendingFavoriteId = company.Id;
    this.confirmModalTarget.classList.remove('hidden');
  }

  #onEditClick(company) {
    if (!this.#hasPerm('F_ModifyCompany')) {
      this.#showToast('info', 'Opción no disponible, ya que no posee los permisos.');
      return;
    }
    window.location.href = `/configurations/companies/${company.Id}/edit`;
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  #statusBadge(status) {
    const map = {
      active:   { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'   },
      inactive: { bg: '#fdecea', color: '#c0392b', label: 'Inactivo' },
    };
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    return `<span style="background-color:${bg}; color:${color};"
                  class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${label}
    </span>`;
  }

  #actionBtn(icon, tooltip, type, id) {
    return `
      <div class="relative group inline-block">
        <button type="button"
                data-action-type="${type}"
                data-id="${id}"
                data-testid="btn-${type}"
                class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
          <span class="material-icons text-base">${icon}</span>
        </button>
        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                     whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white
                     opacity-0 group-hover:opacity-100 transition-opacity z-10">
          ${tooltip}
        </span>
      </div>`;
  }

  #setLoading(isLoading) {
    if (isLoading) {
      this.loadingStateTarget.classList.remove('hidden');
      this.emptyStateTarget.classList.add('hidden');
      this.tbodyTarget.innerHTML = '';
    } else {
      this.loadingStateTarget.classList.add('hidden');
    }
  }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  #showToast(type, message) {
    const config = {
      success: { bg: 'bg-green-600', icon: 'check_circle'  },
      error:   { bg: 'bg-red-600',   icon: 'error_outline' },
      info:    { bg: 'bg-blue-600',  icon: 'info'          },
    };
    const { bg, icon } = config[type] ?? config.info;

    const toast = this.toastTarget;
    toast.className = `fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-64 max-w-sm ${bg}`;
    this.toastIconTarget.textContent    = icon;
    this.toastMessageTarget.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  #esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
        'Content-Type':            'application/json',
        'API':                     'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(text || `HTTP ${response.status}`);
    }

    return response.json();
  }
}
