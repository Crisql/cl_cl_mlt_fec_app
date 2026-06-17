/**
 * UsersController — Gestión de Usuarios (/configurations/users)
 *
 * Migración de /configurations/users (Angular UsersComponent + 3 tabs):
 *   Tab 0 - Lista de Usuarios      (perm: Configurations_Users_ListAccess)
 *   Tab 1 - Completar Registro     (perm: S_CompUser)
 *   Tab 2 - Asignación de compañías (perm: S_AsigUser)
 *
 * Rutas relacionadas:
 *   /configurations/users/register  → users-register controller
 *   /configurations/users/edit      → users-edit controller
 */

import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES, confirm } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

// ── Compañías que requieren campo Tipo de OC ──────────────────────────────────
const COMPANIES_WITH_OC = new Set([186, 1206]);

export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,
    // Tabs nav
    'tabBtn', 'tabContent',
    // Tab Lista
    'searchName', 'searchEmail', 'createBtn',
    // Tab Completar Registro
    'completeTable',
    // Tab Asignación
    'userInput', 'userDropdown',
    'groupInput', 'groupDropdown',
    'unassignedList', 'assignedList',
    'emptyUnassigned', 'emptyAssigned',
    'unassignedCount', 'assignedCount',
    'changesBadge', 'changesBadgeValue',
    'changesSummary', 'assignSummaryRow', 'unassignSummaryRow',
    'assignCount', 'unassignCount',
    'emptyState', 'assignmentPanel', 'assignmentLoader',
    'applyBtn', 'cancelBtn',
    // Edit panel
    'editPanel', 'editBackdrop', 'editLoadingOverlay',
    'editFullName', 'editFullNameError',
    'editIdentification', 'editIdentificationError',
    'editSapUser', 'editSapUserError',
    'editSapPass', 'editPassIcon',
    'editCredentialCompany',
    'editActiveCheck',
    'editTestCredBtn', 'editTestCredIcon', 'editTestCredLabel',
    'editSubmitBtn',
  ];

  // ── Estado ──────────────────────────────────────────────────────────────────

  #companyId    = null;
  #permissions  = [];
  #activeTab    = null;
  #visibleTabs  = [];

  // Lista tab
  // (tabla principal gestionada por TabulatorController)

  // Completar Registro tab
  #completeTabulator = null;

  // Edit panel
  #editUserId           = null;
  #editUserInfo         = null;
  #credentialsDirty     = false;
  #credentialsValidated = false;

  // Asignación tab
  #usersList         = [];
  #usersFiltered     = [];
  #groupsList        = [];
  #groupsFiltered    = [];
  #allCompanies      = [];
  #assignedCompanies = [];
  #unassignedCompanies = [];
  #initialAssignedIds = new Set();
  #currentAssignedIds = new Set();
  #selectedUserId     = null;
  #selectedGroupId    = -1;
  #toAssign           = [];
  #toUnassign         = [];
  #draggedCompanyId   = null;
  #draggedFromZone    = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  connect() {
    const company = SStore.get('CurrentCompany');
    this.#companyId  = company?.companyId ? parseInt(company.companyId) : null;
    this.#permissions = SStore.get('Permissions') || [];

    this.#buildVisibleTabs();

    if (this.#visibleTabs.length === 0) {
      Turbo.visit('/home');
      return;
    }

    // Activar el tab ANTES de super.connect() para que Tabulator inicialice
    // en un contenedor visible (evita null en offsetWidth / elVisible)
    this.#activateTab(this.#visibleTabs[0]);

    // TabulatorController inicializa la tabla en el target "table"
    super.connect();   // construye la tabla y dispara la carga vía ajaxRequestFunc
  }

  disconnect() {
    this.#completeTabulator?.destroy();
    super.disconnect?.();
  }

  // ── Configuración Tabulator (Tab Lista) ─────────────────────────────────────

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      data: undefined,   // evita que el [] heredado suprima la carga via ajaxRequestFunc
      height: '100%',
      maxHeight: undefined,  // anula el tope de 500px del config base
      layout: 'fitColumns',
      placeholder: 'No hay usuarios',
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [10, 25, 50],
      paginationCounter: 'rows',
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: { headerSort: true },
      columns: this.getColumns(),
      // Carga via el data-loader de Tabulator (igual que companies): dataLoaderLoading
      // muestra el spinner a nivel de tabla durante el fetch. Paginacion local.
      ajaxURL: '/api/User/accessible',
      ajaxRequestFunc: () => this.#loadListData(),
      ajaxResponse:    (_url, _params, response) => response,
    };
  }

  getColumns() {
    const hasPerm = this.#hasPerm('Configurations_Users_Update');
    return [
      { title: 'Nombre Completo',    field: 'FullName',         flexGrow: 2, minWidth: 150 },
      { title: 'Correo Electrónico', field: 'Email',            flexGrow: 2, minWidth: 180 },
      { title: 'Identificación',     field: 'Identification',   flexGrow: 1, minWidth: 70 },
      { title: 'Usuario SAP',        field: 'SapUser',          flexGrow: 1, minWidth: 110 },
      {
        title: 'Fecha de Creación',
        field: 'CreateDate',
        flexGrow: 1, minWidth: 150,
        formatter: (cell) => this.#formatDateTime(cell.getValue()),
      },
      {
        title: 'Correo Confirmado',
        field: 'EmailConfirmed',
        width: 185, hozAlign: 'center',
        formatter: (cell) => this.#boolIcon(cell.getValue()),
      },
      {
        title: 'Estado',
        field: 'Active',
        width: 100, hozAlign: 'center',
        formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
      },
      ...(hasPerm ? [{
        title: 'Acciones',
        field: '_actions',
        width: 80, hozAlign: 'center', headerSort: false,
        formatter: () => `
          <button type="button" data-action-type="edit" data-tooltip="Editar"
                  class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
            <span class="material-icons text-base">edit</span>
          </button>`,
        cellClick: (_e, cell) => this.#onEditClick(cell.getRow().getData()),
      }] : []),
    ];
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  #buildVisibleTabs() {
    this.tabBtnTargets.forEach(btn => {
      const perm = btn.dataset.perm;
      if (!perm || this.#hasPerm(perm)) {
        this.#visibleTabs.push(btn.dataset.tabName);
      } else {
        btn.classList.add('hidden');
      }
    });
  }

  switchTab(event) {
    const name = event.currentTarget.dataset.tabName;
    if (name === this.#activeTab) return;
    this.#activateTab(name);
    this.#loadTabData(name);
  }

  #activateTab(name) {
    this.#activeTab = name;

    // Update tab buttons
    this.tabBtnTargets.forEach(btn => {
      const isActive = btn.dataset.tabName === name;
      btn.classList.toggle('border-blue-600', isActive);
      btn.classList.toggle('text-blue-600',   isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('text-gray-500',   !isActive);
    });

    // Show/hide content
    this.tabContentTargets.forEach(panel => {
      const visible = panel.dataset.tab === name;
      panel.classList.toggle('hidden', !visible);
      panel.classList.toggle('flex',   visible);
    });

    // Redraw solo en tab switches posteriores al init (this.table es null durante el init inicial)
    if (name === 'list' && this.table) {
      setTimeout(() => { try { this.table.redraw(true); } catch (_) {} }, 50);
    } else if (name === 'complete-registration' && this.#completeTabulator) {
      setTimeout(() => { try { this.#completeTabulator.redraw(true); } catch (_) {} }, 50);
    }
  }

  #loadTabData(name) {
    if (name === 'list')                   this.table?.setData();
    if (name === 'complete-registration')  this.#loadCompleteRegData();
    if (name === 'assignment')             this.#loadAssignmentInitialData();
  }

  // ── Tab Lista — carga de datos ────────────────────────────────────────────────

  // Retorna el array de usuarios. Lo invoca ajaxRequestFunc, de modo que Tabulator
  // muestra dataLoaderLoading (spinner a nivel de tabla) durante el fetch.
  async #loadListData() {
    const name  = this.searchNameTarget.value.trim();
    const email = this.searchEmailTarget.value.trim();
    try {
      const data = await this.#apiFetch(
        `/api/User/accessible?fullName=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&activeOnly=false`
      );
      const rows = data.Data || [];
      if (!rows.length) showToast(data.Message || 'No se encontraron usuarios.', 'warning');

      // Mostrar botón Crear si tiene permiso
      if (this.#hasPerm('S_RegUser')) {
        this.createBtnTarget.classList.remove('hidden');
        this.createBtnTarget.classList.add('inline-flex');
      }
      return rows;
    } catch (err) {
      showToast(err.message || 'Error al cargar usuarios.', 'error');
      return [];
    }
  }

  searchUsers() {
    this.table?.setData();
  }

  #onEditClick(row) {
    this.#openEditPanel(row.Id);
  }

  // ── Edit panel ────────────────────────────────────────────────────────────────

  #openEditPanel(userId) {
    this.#editUserId = userId;
    this.editBackdropTarget.classList.remove('hidden');
    this.editPanelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
    this.#loadEditUser(userId);
  }

  closeEditPanel() {
    this.editPanelTarget.classList.add('translate-x-full');
    this.editBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
    this.#editUserId   = null;
    this.#editUserInfo = null;
  }

  async #loadEditUser(userId) {
    this.editLoadingOverlayTarget.classList.remove('hidden');
    try {
      const [userRes, companiesRes] = await Promise.all([
        this.#apiFetch(`/api/User/information?userId=${encodeURIComponent(userId)}`),
        this.#apiFetch(`/api/User/companies?userId=${encodeURIComponent(userId)}`),
      ]);
      if (!userRes.Data) {
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: 'No se encontró el usuario.' });
        this.closeEditPanel();
        return;
      }
      this.#editUserInfo = userRes.Data;
      this.#fillEditForm(userRes.Data);
      this.#populateEditCompanies(companiesRes.Data || []);
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al cargar usuario', message: err.message });
      this.closeEditPanel();
    } finally {
      this.editLoadingOverlayTarget.classList.add('hidden');
    }
  }

  #fillEditForm(user) {
    this.editFullNameTarget.value       = user.FullName       || '';
    this.editIdentificationTarget.value = user.Identification || '';
    this.editSapUserTarget.value        = user.SapUser        || '';
    this.editSapPassTarget.value        = '';
    this.editActiveCheckTarget.checked  = !!user.Active;
    this.#credentialsDirty     = false;
    this.#credentialsValidated = false;
    this.editFullNameErrorTarget.classList.add('hidden');
    this.editIdentificationErrorTarget.classList.add('hidden');
    this.editSapUserErrorTarget.classList.add('hidden');
    this.#updateEditTestCredBtn();
    this.#updateEditSubmitBtn();
  }

  #populateEditCompanies(companies) {
    this.editCredentialCompanyTarget.innerHTML = '<option value="">-- Seleccione --</option>';
    companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.Id;
      opt.textContent = c.EmsrNombreComercial || c.EmsrNombre;
      this.editCredentialCompanyTarget.appendChild(opt);
    });
  }

  toggleEditPassVisibility() {
    const isPass = this.editSapPassTarget.type === 'password';
    this.editSapPassTarget.type = isPass ? 'text' : 'password';
    this.editPassIconTarget.textContent = isPass ? 'visibility' : 'visibility_off';
  }

  onEditSapFieldChange() {
    this.#credentialsDirty     = true;
    this.#credentialsValidated = false;
    this.#updateEditTestCredBtn();
    this.#updateEditSubmitBtn();
  }

  onEditCredentialCompanyChange() {
    this.#credentialsValidated = false;
    this.#updateEditTestCredBtn();
    this.#updateEditSubmitBtn();
  }

  #updateEditTestCredBtn() {
    const canTest = this.#credentialsDirty && !!this.editCredentialCompanyTarget.value;
    this.editTestCredBtnTarget.disabled = !canTest;
    if (this.#credentialsValidated) {
      this.editTestCredIconTarget.textContent  = 'check_circle';
      this.editTestCredLabelTarget.textContent = 'Credenciales verificadas';
      this.editTestCredBtnTarget.classList.add('text-green-600', 'border-green-400');
      this.editTestCredBtnTarget.classList.remove('text-gray-700', 'border-gray-300');
    } else {
      this.editTestCredIconTarget.textContent  = 'wifi_tethering';
      this.editTestCredLabelTarget.textContent = 'Probar credenciales';
      this.editTestCredBtnTarget.classList.remove('text-green-600', 'border-green-400');
      this.editTestCredBtnTarget.classList.add('text-gray-700', 'border-gray-300');
    }
  }

  #updateEditSubmitBtn() {
    this.editSubmitBtnTarget.disabled = this.#credentialsDirty && !this.#credentialsValidated;
  }

  async testEditCredentials() {
    const sapUser   = this.editSapUserTarget.value.trim();
    const sapPass   = this.editSapPassTarget.value;
    const companyId = parseInt(this.editCredentialCompanyTarget.value);

    if (!sapUser || !sapPass) {
      showToast('Complete Usuario y Contraseña de SAP antes de probar.', 'warning');
      return;
    }
    if (!companyId) {
      showToast('Seleccione una compañía para probar las credenciales.', 'warning');
      return;
    }

    this.editTestCredBtnTarget.disabled = true;
    this.editTestCredIconTarget.textContent  = 'hourglass_empty';
    this.editTestCredLabelTarget.textContent = 'Probando...';

    try {
      const res = await this.#apiFetch('/api/SapConnections/validate-credentials', {
        method: 'POST',
        body: JSON.stringify({ SapUser: sapUser, SapPass: sapPass, CompanyId: companyId }),
      });
      if (res.Data === true) {
        this.#credentialsValidated = true;
        showToast('Credenciales válidas', 'success');
      } else {
        this.#credentialsValidated = false;
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Credenciales inválidas', message: res.Message || 'No se pudo conectar a SAP.' });
      }
    } catch (err) {
      this.#credentialsValidated = false;
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al validar', message: err.message });
    } finally {
      this.#updateEditTestCredBtn();
      this.#updateEditSubmitBtn();
    }
  }

  async saveEditUser() {
    if (!this.#runEditValidation()) return;

    this.editLoadingOverlayTarget.classList.remove('hidden');
    this.editSubmitBtnTarget.disabled = true;

    const payload = {
      ...this.#editUserInfo,
      Id:             this.#editUserId,
      FullName:       this.editFullNameTarget.value.trim(),
      Identification: this.editIdentificationTarget.value.trim(),
      SapUser:        this.editSapUserTarget.value.trim(),
      SapPass:        this.editSapPassTarget.value || '',
      Active:         this.editActiveCheckTarget.checked,
    };

    try {
      await this.#apiFetch('/api/User', { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Usuario actualizado con éxito', 'success');
      this.closeEditPanel();
      this.table?.setData();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar usuario', message: err.message });
      this.editSubmitBtnTarget.disabled = false;
    } finally {
      this.editLoadingOverlayTarget.classList.add('hidden');
    }
  }

  #runEditValidation() {
    let valid = true;
    const check = (target, errorTarget, condition) => {
      const ok = condition();
      errorTarget.classList.toggle('hidden', ok);
      if (!ok) valid = false;
    };
    check(this.editFullNameTarget,       this.editFullNameErrorTarget,       () => !!this.editFullNameTarget.value.trim());
    check(this.editIdentificationTarget, this.editIdentificationErrorTarget, () => !!this.editIdentificationTarget.value.trim());
    check(this.editSapUserTarget,        this.editSapUserErrorTarget,        () => !!this.editSapUserTarget.value.trim());
    return valid;
  }

  // ── Tab Completar Registro ───────────────────────────────────────────────────

  async #loadCompleteRegData() {
    if (!this.#completeTabulator) {
      await this.#initCompleteTable();   // su ajaxRequestFunc dispara la carga inicial (loader de tabla)
      return;
    }
    this.#completeTabulator.setData();   // recarga via ajaxRequestFunc (loader a nivel de tabla)
  }

  // Retorna usuarios inactivos. Lo invoca ajaxRequestFunc => dataLoaderLoading (loader de tabla).
  async #fetchInactiveUsers() {
    try {
      const data = await this.#apiFetch(`/api/User/GetInactiveUsers?companyId=${this.#companyId}`);
      const rows = (data.Data || []).map(u => ({
        ...u,
        _activeLabel:    u.Active         ? 'Sí' : 'No',
        _confirmedLabel: u.EmailConfirmed ? 'Sí' : 'No',
      }));
      if (!rows.length) showToast(data.Message || 'No hay usuarios pendientes de activación.', 'info');
      return rows;
    } catch (err) {
      showToast(err.message || 'Error al cargar usuarios inactivos.', 'error');
      return [];
    }
  }

  async #initCompleteTable() {
    const { TabulatorFull } = await import('tabulator-tables');
    this.#completeTabulator = new TabulatorFull(this.completeTableTarget, {
      height: '100%',
      maxHeight: undefined,
      layout: 'fitColumns',
      placeholder: 'No hay usuarios pendientes',
      locale: TABULATOR_LOCALE,
      langs: TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      ajaxURL: '/api/User/GetInactiveUsers',
      ajaxRequestFunc: () => this.#fetchInactiveUsers(),
      ajaxResponse:    (_url, _params, response) => response,
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [5, 10, 25],
      paginationCounter: 'rows',
      columnDefaults: { headerSort: false },
      columns: [
        { title: 'Identificación', field: 'Identification', flexGrow: 1, minWidth: 70 },
        { title: 'Nombre',         field: 'FullName',       flexGrow: 2, minWidth: 150 },
        { title: 'Correo',         field: 'Email',          flexGrow: 2, minWidth: 180 },
        {
          title: 'Correo Confirmado', field: 'EmailConfirmed', width: 185, hozAlign: 'center',
          formatter: (cell) => this.#boolIcon(cell.getValue()),
        },
        {
          title: 'Estado', field: 'Active', width: 100, hozAlign: 'center',
          formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
        },
        {
          title: 'Acciones', field: '_actions', width: 120,
          hozAlign: 'center', headerSort: false,
          formatter: () => `
            <button type="button" data-action-type="activate" data-tooltip="Activar Usuario"
                    class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer mr-1">
              <span class="material-icons text-base">how_to_reg</span>
            </button>
            <button type="button" data-action-type="resend" data-tooltip="Reenviar Correo Confirmación"
                    class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
              <span class="material-icons text-base">send</span>
            </button>`,
          cellClick: (e, cell) => {
            const btn = e.target.closest('button[data-action-type]');
            if (!btn) return;
            const row = cell.getRow().getData();
            if (btn.dataset.actionType === 'activate')  this.#activateUser(row);
            if (btn.dataset.actionType === 'resend')    this.#resendConfirmation(row);
          },
        },
      ],
    });
    // Setup tooltip para la segunda tabla (setupTooltip() base usa this.tableTarget;
    // replicamos la delegación directamente sobre completeTableTarget)
    if (!document.getElementById('cl-tabulator-tooltip')) this.setupTooltip?.();
    const tip = document.getElementById('cl-tabulator-tooltip');
    if (tip) {
      let activeBtn = null;
      this.completeTableTarget.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('[data-tooltip]');
        if (btn && btn !== activeBtn) { activeBtn = btn; tip.textContent = btn.dataset.tooltip; tip.style.opacity = '1'; }
        else if (!btn) { activeBtn = null; tip.style.opacity = '0'; }
      });
      this.completeTableTarget.addEventListener('mousemove', (e) => {
        if (!activeBtn) return;
        tip.style.left = (e.clientX + 10) + 'px';
        tip.style.top  = (e.clientY - 32) + 'px';
      });
      this.completeTableTarget.addEventListener('mouseleave', () => { activeBtn = null; tip.style.opacity = '0'; });
    }
  }

  async #activateUser(user) {
    this.#completeTabulator?.alert(TABULATOR_LOADING_HTML);
    try {
      await this.#apiFetch(`/api/User/activate?userId=${encodeURIComponent(user.Id)}`, { method: 'PATCH' });
      showToast('El usuario se activó con éxito', 'success');
      this.#completeTabulator?.clearAlert();
      await this.#loadCompleteRegData();
    } catch (err) {
      this.#completeTabulator?.clearAlert();
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al activar usuario', message: err.message });
    }
  }

  async #resendConfirmation(user) {
    this.#completeTabulator?.alert(TABULATOR_LOADING_HTML);
    try {
      await this.#apiFetch(`/api/User/email-confirmations?userId=${encodeURIComponent(user.Id)}`, { method: 'POST' });
      showToast('El correo de confirmación ha sido enviado con éxito', 'success');
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al reenviar correo', message: err.message });
    } finally {
      this.#completeTabulator?.clearAlert();
    }
  }

  // ── Tab Asignación — carga inicial ──────────────────────────────────────────

  #showAssignmentLoader() { if (this.hasAssignmentLoaderTarget) this.assignmentLoaderTarget.classList.remove('hidden'); }
  #hideAssignmentLoader() { if (this.hasAssignmentLoaderTarget) this.assignmentLoaderTarget.classList.add('hidden'); }

  async #loadAssignmentInitialData() {
    if (this.#usersList.length) return; // ya cargado

    this.#showAssignmentLoader();
    try {
      const [usersRes, groupsRes, companiesRes] = await Promise.all([
        this.#apiFetch('/api/User/for-assignments'),
        this.#apiFetch('/api/Group/for-assignments'),
        this.#apiFetch('/api/Companies/for-assignment?groupId=-1'),
      ]);

      this.#usersList     = usersRes.Data || [];
      this.#usersFiltered = [...this.#usersList];

      const allGroup = { Id: -1, GroupName: 'Todos' };
      this.#groupsList    = [allGroup, ...(groupsRes.Data || [])];
      this.#groupsFiltered = [...this.#groupsList];

      this.#allCompanies = companiesRes.Data || [];
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al cargar datos', message: err.message });
    } finally {
      this.#hideAssignmentLoader();
    }
  }

  // ── Autocomplete Usuario ─────────────────────────────────────────────────────

  showUserDropdown() {
    this.#usersFiltered = [...this.#usersList];
    this.#renderUserDropdown();
  }

  filterUsers() {
    const q = this.userInputTarget.value.toLowerCase();
    this.#usersFiltered = q
      ? this.#usersList.filter(u => u.Email.toLowerCase().includes(q))
      : [...this.#usersList];
    this.#renderUserDropdown();
  }

  #renderUserDropdown() {
    const ul = this.userDropdownTarget;
    ul.innerHTML = '';
    this.#usersFiltered.slice(0, 50).forEach(u => {
      const li = document.createElement('li');
      li.textContent = u.Email;
      li.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer';
      li.addEventListener('mousedown', () => {
        this.userInputTarget.value = u.Email;
        ul.classList.add('hidden');
        this.#onUserSelected(u);
      });
      ul.appendChild(li);
    });
    ul.classList.toggle('hidden', this.#usersFiltered.length === 0);

    const hide = () => ul.classList.add('hidden');
    this.userInputTarget.addEventListener('blur', hide, { once: true });
  }

  async #onUserSelected(user) {
    this.#selectedUserId = user.Id;
    this.#clearCompanyLists();

    this.#showAssignmentLoader();
    try {
      const res = await this.#apiFetch(
        `/api/User/assigned-companies?userId=${encodeURIComponent(user.Id)}`
      );
      const assignedIds = new Set((res.Data || []).map(c => c.Id));

      this.#allCompanies.forEach(c => {
        if (assignedIds.has(c.Id)) {
          this.#assignedCompanies.push(c);
          this.#initialAssignedIds.add(c.Id);
          this.#currentAssignedIds.add(c.Id);
        } else {
          this.#unassignedCompanies.push(c);
        }
      });

      this.#renderLists();
      this.emptyStateTarget.classList.add('hidden');
      this.assignmentPanelTarget.classList.remove('hidden');
      this.assignmentPanelTarget.classList.add('flex');
    } catch (err) {
      showToast(err.message || 'Error al cargar las compañías del usuario.', 'error');
    } finally {
      this.#hideAssignmentLoader();
    }
  }

  // ── Autocomplete Grupo ───────────────────────────────────────────────────────

  showGroupDropdown() {
    this.#groupsFiltered = [...this.#groupsList];
    this.#renderGroupDropdown();
  }

  filterGroups() {
    const q = this.groupInputTarget.value.toLowerCase();
    this.#groupsFiltered = q
      ? this.#groupsList.filter(g => g.GroupName.toLowerCase().includes(q))
      : [...this.#groupsList];
    this.#renderGroupDropdown();
  }

  #renderGroupDropdown() {
    const ul = this.groupDropdownTarget;
    ul.innerHTML = '';
    this.#groupsFiltered.forEach(g => {
      const li = document.createElement('li');
      li.textContent = g.GroupName;
      li.className = 'px-3 py-2 hover:bg-blue-50 cursor-pointer';
      li.addEventListener('mousedown', () => {
        this.groupInputTarget.value = g.GroupName;
        ul.classList.add('hidden');
        this.#onGroupSelected(g);
      });
      ul.appendChild(li);
    });
    ul.classList.toggle('hidden', this.#groupsFiltered.length === 0);

    const hide = () => ul.classList.add('hidden');
    this.groupInputTarget.addEventListener('blur', hide, { once: true });
  }

  async #onGroupSelected(group) {
    this.#selectedGroupId = group.Id ?? -1;

    this.#showAssignmentLoader();
    try {
      const res = await this.#apiFetch(`/api/Companies/for-assignment?groupId=${this.#selectedGroupId}`);
      this.#allCompanies = res.Data || [];

      if (this.#selectedUserId) {
        await this.#onUserSelected(
          this.#usersList.find(u => u.Id === this.#selectedUserId)
        );
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar compañías del grupo.', 'error');
    } finally {
      this.#hideAssignmentLoader();
    }
  }

  // ── Dual list ─────────────────────────────────────────────────────────────────

  #renderLists() {
    this.#renderSingleList(this.unassignedListTarget, this.emptyUnassignedTarget, this.#unassignedCompanies, 'unassigned');
    this.#renderSingleList(this.assignedListTarget,   this.emptyAssignedTarget,   this.#assignedCompanies,   'assigned');
    this.unassignedCountTarget.textContent = this.#unassignedCompanies.length;
    this.assignedCountTarget.textContent   = this.#assignedCompanies.length;
  }

  #renderSingleList(listEl, emptyEl, companies, zone) {
    // Remove all draggable items, keep the empty state div
    Array.from(listEl.children).forEach(child => {
      if (child !== emptyEl) child.remove();
    });

    if (companies.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    const isAssigned = zone === 'assigned';
    companies.forEach(c => {
      const div = document.createElement('div');
      div.draggable = true;
      div.className = `flex items-center gap-3 p-3 mb-2 bg-white border rounded-lg cursor-move
        transition-all hover:shadow-md hover:-translate-y-0.5
        ${isAssigned ? 'border-l-4 border-l-blue-400 border-gray-200' : 'border-gray-200'}`;
      div.innerHTML = `
        <span class="material-icons text-sm text-gray-400">drag_indicator</span>
        <span class="flex-1 text-sm text-gray-700">${c.ComercialName || c.LegalName}</span>
        <span class="text-xs text-gray-400">#${c.Id}</span>`;
      div.addEventListener('dragstart', () => {
        this.#draggedCompanyId = c.Id;
        this.#draggedFromZone  = zone;
        div.classList.add('opacity-50');
      });
      div.addEventListener('dragend', () => {
        div.classList.remove('opacity-50');
      });
      listEl.appendChild(div);
    });
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────────

  onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
  }

  onDragLeave(event) {
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
  }

  onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
    const targetZone = event.currentTarget.dataset.dropZone;
    if (!this.#draggedCompanyId || this.#draggedFromZone === targetZone) return;

    const companyId = this.#draggedCompanyId;
    if (targetZone === 'assigned') {
      const idx = this.#unassignedCompanies.findIndex(c => c.Id === companyId);
      if (idx !== -1) {
        const [company] = this.#unassignedCompanies.splice(idx, 1);
        this.#assignedCompanies.push(company);
        this.#currentAssignedIds.add(companyId);
      }
    } else {
      const idx = this.#assignedCompanies.findIndex(c => c.Id === companyId);
      if (idx !== -1) {
        const [company] = this.#assignedCompanies.splice(idx, 1);
        this.#unassignedCompanies.push(company);
        this.#currentAssignedIds.delete(companyId);
      }
    }
    this.#draggedCompanyId = null;
    this.#draggedFromZone  = null;
    this.#calculateChanges();
    this.#renderLists();
  }

  #transferCompany(company, fromZone) {
    if (fromZone === 'unassigned') {
      this.#unassignedCompanies = this.#unassignedCompanies.filter(c => c.Id !== company.Id);
      this.#assignedCompanies.push(company);
      this.#currentAssignedIds.add(company.Id);
    } else {
      this.#assignedCompanies = this.#assignedCompanies.filter(c => c.Id !== company.Id);
      this.#unassignedCompanies.push(company);
      this.#currentAssignedIds.delete(company.Id);
    }
    this.#calculateChanges();
    this.#renderLists();
  }

  assignAll() {
    this.#unassignedCompanies.forEach(c => {
      this.#assignedCompanies.push(c);
      this.#currentAssignedIds.add(c.Id);
    });
    this.#unassignedCompanies = [];
    this.#calculateChanges();
    this.#renderLists();
  }

  unassignAll() {
    this.#assignedCompanies.forEach(c => {
      this.#unassignedCompanies.push(c);
      this.#currentAssignedIds.delete(c.Id);
    });
    this.#assignedCompanies = [];
    this.#calculateChanges();
    this.#renderLists();
  }

  #calculateChanges() {
    this.#toAssign   = [];
    this.#toUnassign = [];

    this.#currentAssignedIds.forEach(id => {
      if (!this.#initialAssignedIds.has(id)) this.#toAssign.push(id);
    });
    this.#initialAssignedIds.forEach(id => {
      if (!this.#currentAssignedIds.has(id)) this.#toUnassign.push(id);
    });

    const hasChanges = this.#toAssign.length > 0 || this.#toUnassign.length > 0;
    const total      = this.#toAssign.length + this.#toUnassign.length;

    this.applyBtnTarget.disabled  = !hasChanges;
    this.cancelBtnTarget.disabled = !hasChanges;

    if (hasChanges) {
      this.changesBadgeTarget.classList.remove('hidden');
      this.changesBadgeTarget.classList.add('flex');
      this.changesBadgeValueTarget.textContent = total;
    } else {
      this.changesBadgeTarget.classList.add('hidden');
      this.changesBadgeTarget.classList.remove('flex');
    }

    this.#updateSummary();
  }

  #updateSummary() {
    const hasChanges = this.#toAssign.length > 0 || this.#toUnassign.length > 0;
    this.changesSummaryTarget.classList.toggle('hidden', !hasChanges);

    if (this.#toAssign.length > 0) {
      this.assignSummaryRowTarget.classList.remove('hidden');
      this.assignSummaryRowTarget.classList.add('flex');
      this.assignCountTarget.textContent = this.#toAssign.length;
    } else {
      this.assignSummaryRowTarget.classList.add('hidden');
      this.assignSummaryRowTarget.classList.remove('flex');
    }

    if (this.#toUnassign.length > 0) {
      this.unassignSummaryRowTarget.classList.remove('hidden');
      this.unassignSummaryRowTarget.classList.add('flex');
      this.unassignCountTarget.textContent = this.#toUnassign.length;
    } else {
      this.unassignSummaryRowTarget.classList.add('hidden');
      this.unassignSummaryRowTarget.classList.remove('flex');
    }
  }

  #clearCompanyLists() {
    this.#assignedCompanies   = [];
    this.#unassignedCompanies = [];
    this.#initialAssignedIds.clear();
    this.#currentAssignedIds.clear();
    this.#toAssign          = [];
    this.#toUnassign        = [];
    this.#draggedCompanyId  = null;
    this.#draggedFromZone   = null;
    this.applyBtnTarget.disabled  = true;
    this.cancelBtnTarget.disabled = true;
    this.changesBadgeTarget.classList.add('hidden');
    this.changesBadgeTarget.classList.remove('flex');
    this.changesSummaryTarget.classList.add('hidden');
  }

  async applyChanges() {
    if (!this.#selectedUserId) {
      showToast('Debe seleccionar un usuario.', 'warning');
      return;
    }
    if (!this.#toAssign.length && !this.#toUnassign.length) {
      showToast('No hay cambios para aplicar.', 'info');
      return;
    }

    const selectedUser = this.#usersList.find(u => u.Id === this.#selectedUserId);
    if (!selectedUser) return;

    this.#showAssignmentLoader();
    try {
      const requests = [];
      if (this.#toAssign.length) {
        requests.push(this.#apiFetch('/api/User/bulk-assign-companies', {
          method: 'POST',
          body: JSON.stringify({ User: selectedUser.Email, CompanyIds: this.#toAssign }),
        }));
      }
      if (this.#toUnassign.length) {
        requests.push(this.#apiFetch('/api/User/bulk-unassign-companies', {
          method: 'POST',
          body: JSON.stringify({ User: selectedUser.Email, CompanyIds: this.#toUnassign }),
        }));
      }
      await Promise.all(requests);

      showToast('Cambios aplicados exitosamente', 'success');

      // Actualizar estado inicial
      this.#initialAssignedIds.clear();
      this.#currentAssignedIds.forEach(id => this.#initialAssignedIds.add(id));
      this.#toAssign   = [];
      this.#toUnassign = [];
      this.#calculateChanges();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al aplicar cambios', message: err.message });
    } finally {
      this.#hideAssignmentLoader();
    }
  }

  async cancelChanges() {
    if (this.#selectedUserId) {
      const user = this.#usersList.find(u => u.Id === this.#selectedUserId);
      if (user) {
        this.#clearCompanyLists();
        await this.#onUserSelected(user);
      }
    } else {
      this.#clearCompanyLists();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  #statusBadge(status, customLabel = null) {
    const map = {
      active:    { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'    },
      inactive:  { bg: '#fdecea', color: '#c0392b', label: 'Inactivo'  },
      confirmed: { bg: '#e8f0fe', color: '#1a56db', label: 'Sí'        },
      pending:   { bg: '#fffbeb', color: '#b45309', label: 'No'        },
    };
    const cfg = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    const label = customLabel ?? cfg.label;
    return `<span style="background-color:${cfg.bg}; color:${cfg.color};"
               class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${label}
    </span>`;
  }

  #boolIcon(value) {
    return value
      ? `<span class="material-icons text-base" style="color:#1a56db;">check_circle_outline</span>`
      : `<span class="material-icons" style="color:#9ca3af;">radio_button_unchecked</span>`;
  }

  #formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ── apiFetch ──────────────────────────────────────────────────────────────────

  async #apiFetch(url, options = {}) {
    const session   = Storage.get('Session') || {};
    const token     = session.access_token;
    const company   = SStore.get('CurrentCompany');
    const companyId = company?.companyId ?? this.#companyId;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type':             'application/json',
        'API':                      'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token     ? { Authorization:    `Bearer ${token}` }  : {}),
        ...(companyId ? { 'Cl-Company-Id': String(companyId) }   : {}),
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
