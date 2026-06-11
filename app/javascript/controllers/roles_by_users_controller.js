/**
 * RolesByUsersController — Asignación de Rol por Usuario y Compañía.
 *
 * Migración de /rolUserCompany → /configurations/roles-by-users
 *
 * Funcionalidad replicada del Angular RolByUserCompanyComponent:
 *   - Carga inicial: GET /api/Rol/GetRoles?companyId → rellena filtro de rol
 *   - GET /api/Rol/GetRolUserCompAssign?rolId&companyId → filas de la tabla
 *   - Tabla Tabulator: columnas UserName, RolName, CompanyName
 *   - Botón "Nuevo" → panel lateral crear
 *   - Botón "Editar" por fila → panel lateral editar (OWNER bloqueado)
 *   - Panel carga usuarios de la compañía: GET /api/User/GetUsersByCompany
 *   - Campo Compañía (autocomplete) solo para usuarios @clavisco.com
 *     → al cambiar recarga roles y usuarios del panel
 *   - POST /api/Rol/AssignRolByUserComp → crear/editar asignación
 */

import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    // filtro
    'roleFilter',
    // panel
    'panelBackdrop', 'panel', 'panelTitle',
    'panelRole', 'panelRoleError',
    'panelUser', 'panelUserError',
    'companyWrapper', 'companyInput', 'companyDropdown',
    'submitBtn', 'submitIcon', 'submitLabel',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado interno ────────────────────────────────────────────────────────

  #companyId    = null;
  #userEmail    = null;
  #isClavisco   = false;

  /** Lista completa de roles (para filtro y panel) */
  #roles        = [];

  /** Lista completa de compañías (solo clavisco) */
  #companies    = [];
  #companiesFilt = [];

  /** Fila en edición (null → crear) */
  #editingRow   = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company = SStore.get('CurrentCompany');
    const session = Storage.get('Session') || {};

    this.#companyId  = company?.companyId ? parseInt(company.companyId) : null;
    this.#userEmail  = session.UserEmail || '';
    this.#isClavisco = this.#userEmail.toLowerCase().includes('@clavisco.com');

    super.connect();
    this.#loadRoles();
  }

  // ── Configuración Tabulator ───────────────────────────────────────────────

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      height: '100%',
      maxHeight: undefined,
      movableRows: false,
      layout: 'fitColumns',
      placeholder: 'No hay asignaciones registradas',
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [10, 20, 50],
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
      { title: 'Usuario',   field: 'UserName',    flexGrow: 1 },
      { title: 'Rol',       field: 'RolName',     flexGrow: 1 },
      {
        title: 'Acciones',
        field: '_actions',
        width: 80,
        hozAlign: 'center',
        headerHozAlign: 'center',
        formatter: () => `
          <button type="button" data-tooltip="Editar"
                  class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer action-edit">
            <span class="material-icons text-base">edit</span>
          </button>`,
        cellClick: (_e, cell) => this.#onEditClick(cell.getRow().getData()),
      },
    ];
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  async #loadRoles() {
    try {
      const data = await this.#apiFetch(`/api/Rol/GetRoles?companyId=${this.#companyId}`);
      this.#roles = data.Data || [];
      this.#populateRoleFilter();
      await this.#loadAssigns();
    } catch (err) {
      showToast(err.message || 'Error al cargar los roles.', 'error');
    }
  }

  #populateRoleFilter() {
    const sel = this.roleFilterTarget;
    // mantener opción "--Todos--"
    sel.querySelectorAll('option:not([value="0"])').forEach(o => o.remove());
    this.#roles.filter(r => r.Active).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.Id;
      opt.textContent = r.Name;
      sel.appendChild(opt);
    });
  }

  async #loadAssigns() {
    const rolId = this.roleFilterTarget.value ?? 0;
    try {
      const data = await this.#apiFetch(
        `/api/Rol/GetRolUserCompAssign?rolId=${rolId}&companyId=${this.#companyId}`
      );
      const rows = data.Data || [];
      if (!rows.length) showToast(data.Message || 'No hay asignaciones.', 'warning');
      this.table?.setData(rows);
    } catch (err) {
      showToast(err.message || 'Error al cargar las asignaciones.', 'error');
    }
  }

  // ── Eventos de filtro ─────────────────────────────────────────────────────

  onRoleFilterChange() { this.#loadAssigns(); }

  // ── Panel lateral ─────────────────────────────────────────────────────────

  openPanelNew() { this.#openPanel(null); }

  #onEditClick(row) {
    if (row.RolName === 'OWNER') {
      showToast('Este rol no permite su edición.', 'info');
      return;
    }
    this.#openPanel(row);
  }

  async #openPanel(row) {
    this.#editingRow = row;
    const isEdit = !!row;

    this.panelTitleTarget.textContent  = isEdit ? 'Editar asignación' : 'Nueva asignación';
    this.submitLabelTarget.textContent = isEdit ? 'Modificar' : 'Crear';
    this.submitIconTarget.textContent  = isEdit ? 'autorenew' : 'check';

    // Mostrar/ocultar campo Compañía
    if (this.#isClavisco) {
      this.companyWrapperTarget.classList.remove('hidden');
      this.companyWrapperTarget.classList.add('flex');
      if (!this.#companies.length) await this.#loadCompanies();
      this.#setCompanyInput(this.#companyId);
    }

    // Poblar usuarios del panel
    await this.#loadPanelUsers(this.#companyId);

    // Poblar roles del panel
    this.#populatePanelRoles(this.#roles);

    // Si editando, preseleccionar valores
    if (isEdit) {
      this.panelRoleTarget.value = row.RolId;
      this.panelUserTarget.value = row.UserId;
    }

    // Limpiar errores
    this.panelRoleErrorTarget.classList.add('hidden');
    this.panelUserErrorTarget.classList.add('hidden');

    // Abrir
    this.panelBackdropTarget.classList.remove('hidden');
    this.panelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  closePanel() {
    this.panelTarget.classList.add('translate-x-full');
    this.panelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
    this.#editingRow = null;
  }

  // ── Panel — compañías (solo clavisco) ─────────────────────────────────────

  async #loadCompanies() {
    try {
      const data = await this.#apiFetch('/api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active');
      this.#companies     = data.Data || [];
      this.#companiesFilt = [...this.#companies];
    } catch (err) {
      showToast(err.message || 'Error al cargar compañías.', 'error');
    }
  }

  #setCompanyInput(companyId) {
    const match = this.#companies.find(c => String(c.Id) === String(companyId));
    this.companyInputTarget.value = match
      ? `${match.EmsrIdeNumero}-${match.EmsrNombreComercial}`
      : '';
    this.companyInputTarget.dataset.selectedId = match ? String(match.Id) : String(this.#companyId);
  }

  onCompanyFocus() {
    this.#companiesFilt = [...this.#companies];
    this.#renderCompanyDropdown();
  }

  onCompanyInput() {
    const q = this.companyInputTarget.value.toLowerCase();
    this.#companiesFilt = this.#companies.filter(c =>
      `${c.EmsrIdeNumero}-${c.EmsrNombreComercial}`.toLowerCase().includes(q)
    );
    this.#renderCompanyDropdown();
  }

  #renderCompanyDropdown() {
    const ul = this.companyDropdownTarget;
    ul.innerHTML = '';
    this.#companiesFilt.slice(0, 50).forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.EmsrIdeNumero}-${c.EmsrNombreComercial}`;
      li.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer';
      li.addEventListener('mousedown', async () => {
        this.companyInputTarget.value = li.textContent;
        this.companyInputTarget.dataset.selectedId = String(c.Id);
        ul.classList.add('hidden');
        // recargar roles y usuarios según la nueva compañía
        await this.#reloadPanelForCompany(c.Id);
      });
      ul.appendChild(li);
    });
    ul.classList.toggle('hidden', this.#companiesFilt.length === 0);

    // cerrar al perder foco
    const hide = () => { ul.classList.add('hidden'); };
    this.companyInputTarget.addEventListener('blur', hide, { once: true });
  }

  async #reloadPanelForCompany(companyId) {
    try {
      const data = await this.#apiFetch(`/api/Rol/GetRoles?companyId=${companyId}`);
      this.#populatePanelRoles(data.Data || []);
    } catch (err) {
      showToast(err.message || 'Error al cargar roles.', 'error');
    }
    await this.#loadPanelUsers(companyId);
  }

  // ── Panel — roles y usuarios ──────────────────────────────────────────────

  #populatePanelRoles(roles) {
    const sel = this.panelRoleTarget;
    sel.innerHTML = '<option value="">-- Seleccione --</option>';
    roles.filter(r => r.Active).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.Id;
      opt.textContent = r.Name;
      sel.appendChild(opt);
    });
  }

  async #loadPanelUsers(companyId) {
    try {
      const data = await this.#apiFetch(`/api/User/GetUsersByCompany?companyId=${companyId}`);
      const users = data.Data || [];
      const sel = this.panelUserTarget;
      sel.innerHTML = '';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.UserId;
        opt.textContent = u.UserName;
        sel.appendChild(opt);
      });
      if (!users.length) showToast(data.Message || 'Sin usuarios para esta compañía.', 'warning');
    } catch (err) {
      showToast(err.message || 'Error al cargar usuarios.', 'error');
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (!this.#validate()) return;

    const selectedCompanyId = this.#isClavisco
      ? parseInt(this.companyInputTarget.dataset.selectedId || this.#companyId)
      : this.#companyId;

    const payload = {
      RolId:     parseInt(this.panelRoleTarget.value),
      UserId:    this.panelUserTarget.value,
      CompanyId: selectedCompanyId,
      RolByUser: this.#editingRow ? this.#editingRow.RolByUser : 0,
    };

    this.submitBtnTarget.disabled = true;
    try {
      await this.#apiFetch('/api/Rol/AssignRolByUserComp/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Asignación realizada correctamente.', 'success');
      this.closePanel();
      await this.#loadRoles();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al guardar la asignación', message: err.message });
    } finally {
      this.submitBtnTarget.disabled = false;
    }
  }

  #validate() {
    let valid = true;
    if (!this.panelRoleTarget.value) {
      this.panelRoleErrorTarget.classList.remove('hidden');
      valid = false;
    } else {
      this.panelRoleErrorTarget.classList.add('hidden');
    }
    if (!this.panelUserTarget.value) {
      this.panelUserErrorTarget.classList.remove('hidden');
      valid = false;
    } else {
      this.panelUserErrorTarget.classList.add('hidden');
    }
    return valid;
  }

  // ── apiFetch ──────────────────────────────────────────────────────────────

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

    if (response.status === 204) return { Message: decodedMessage || '' };

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
