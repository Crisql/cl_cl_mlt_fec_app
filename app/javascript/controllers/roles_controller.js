import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * RolesController — Gestión de roles por compañía (Tabulator).
 *
 * Replica la funcionalidad del componente Angular RolComponent:
 *   - Carga inicial: GET api/Rol/GetRoles?companyId={id} (todos los roles, paginación client-side)
 *   - Tabla Tabulator: Nombre del Rol, Estado (badge), Acciones (editar)
 *   - Botón "Nuevo" → abre modal crear
 *   - Editar por fila → abre modal editar (OWNER bloqueado)
 *   - POST api/Rol para crear (Id=0, Active=true, GroupId=0)
 *   - PATCH api/Rol para editar
 *   - Toast de éxito (showToast) / modal de error
 *
 * Layout full-height: la tabla ocupa toda la altura del contenedor con scroll interno
 * de filas y paginador al pie (height: "100%").
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    'modal',
    'nameInput',
    'nameError',
    'submitBtn',
    'submitIcon',
    'submitLabel',
    'errorModal',
    'errorTitle',
    'errorSubtitle',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ─────────────────────────────────────────────────────────

  /** Lista de roles cargados desde la API */
  #roles = [];

  /** Rol en edición (null si es creación) */
  #editingRole = null;

  /** companyId leído del storage */
  #companyId = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    super.connect();   // construye la tabla Tabulator (vacía)
    this.#loadRoles();
  }

  // ── Configuración Tabulator ─────────────────────────────────────────────────

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      height: '100%',        // llena el contenedor; scroll interno solo si se requiere
      maxHeight: undefined,  // anula el tope de 500px del config base
      movableRows: false,
      layout: 'fitColumns',
      placeholder: 'No hay roles registrados',
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [10, 20, 50, 100],
      paginationCounter: 'rows',
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: { headerSort: false },
      columns: this.getColumns(),
    };
  }

  getColumns() {
    return [
      { title: 'Nombre del Rol', field: 'Name', widthGrow: 3 },
      {
        title: 'Estado',
        field: 'Active',
        width: 130,
        hozAlign: 'left',
        formatter: (cell) => this.#statusBadge(cell.getValue()),
      },
      {
        title: 'Acciones',
        field: 'Id',
        width: 110,
        hozAlign: 'center',
        formatter: () => this.#editButton(),
        cellClick: (e, cell) => {
          if (e.target.closest('[data-action-type="edit"]')) {
            this.#editRole(cell.getRow().getData());
          }
        },
      },
    ];
  }

  // ── API ───────────────────────────────────────────────────────────────────

  async #loadRoles() {
    // Carga client-side: Tabulator no dispara su loader de ajax, así que
    // mostramos el spinner manualmente vía alert() durante el fetch.
    this.table?.alert(TABULATOR_LOADING_HTML);
    try {
      const json = await this.#apiFetch(`/api/Rol/GetRoles?companyId=${this.#companyId}`);

      if (json.Error || !json.Data) {
        this.#showErrorModal(
          'Se produjo un error al obtener los roles',
          json.Message || 'Error desconocido'
        );
        return;
      }

      this.#roles = json.Data;
      this.setData(this.#roles);
    } catch (err) {
      this.#showErrorModal('Se produjo un error al obtener los roles', err.message);
    } finally {
      this.table?.clearAlert();
    }
  }

  async #createRole(name) {
    const payload = {
      role: { Id: 0, Name: name, Active: true, GroupId: 0 },
      companyId: this.#companyId,
    };
    return this.#apiFetch('/api/Rol', { method: 'POST', body: JSON.stringify(payload) });
  }

  async #updateRole(id, name) {
    const payload = {
      role: { Id: id, Name: name, Active: true, GroupId: 0 },
      companyId: this.#companyId,
    };
    return this.#apiFetch('/api/Rol', { method: 'PATCH', body: JSON.stringify(payload) });
  }

  // ── Render helpers (formatters Tabulator) ───────────────────────────────────

  #statusBadge(active) {
    return active
      ? `<span style="background-color:#e8f5ee; color:#3a7d52;" class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Activo</span>`
      : `<span style="background-color:#fdecea; color:#c0392b;" class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Inactivo</span>`;
  }

  #editButton() {
    return `
      <button type="button" data-action-type="edit" data-tooltip="Editar"
              class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
        <span class="material-icons text-base">edit</span>
      </button>`;
  }

  // ── Handlers de eventos ───────────────────────────────────────────────────

  openCreateModal() {
    this.#editingRole = null;
    this.#resetModal();
    this.submitIconTarget.textContent  = 'check';
    this.submitLabelTarget.textContent = 'Crear';
    this.#openModal();
  }

  #editRole(role) {
    if (!role) return;

    if (role.Name === 'OWNER') {
      showToast('Este rol no permite su edición', 'info');
      return;
    }

    this.#editingRole = role;
    this.#resetModal();
    this.nameInputTarget.value         = role.Name;
    this.submitBtnTarget.disabled      = false;
    this.submitIconTarget.textContent  = 'autorenew';
    this.submitLabelTarget.textContent = 'Modificar';
    this.#openModal();
  }

  onNameInput() {
    const hasValue = this.nameInputTarget.value.trim().length > 0;
    this.submitBtnTarget.disabled = !hasValue;
    this.nameErrorTarget.classList.toggle('hidden', hasValue);
  }

  async onSubmit() {
    const name = this.nameInputTarget.value.trim();
    if (!name) return;

    try {
      if (this.#editingRole) {
        await this.#updateRole(this.#editingRole.Id, name);
        showToast('Se actualizó el rol correctamente!!!', 'success');
      } else {
        await this.#createRole(name);
        showToast('Se creó el rol correctamente!!!', 'success');
      }
      this.closeModal();
      await this.#loadRoles();
    } catch (err) {
      const action = this.#editingRole ? 'actualizar' : 'registrar';
      this.#showErrorModal(`Se produjo un error al ${action} el rol`, err.message);
    }
  }

  closeModal() {
    this.modalTarget.classList.add('hidden');
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  #openModal() {
    this.modalTarget.classList.remove('hidden');
    this.nameInputTarget.focus();
  }

  #resetModal() {
    this.nameInputTarget.value    = '';
    this.submitBtnTarget.disabled = true;
    this.nameErrorTarget.classList.add('hidden');
  }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {};
    const token   = session.access_token;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'API': 'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
    if (contentLength === '0' || (!contentType.includes('json') && !contentType.includes('text'))) return {};

    const text = await response.text();
    if (!text || !text.trim()) return {};
    const json = JSON.parse(text);
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
