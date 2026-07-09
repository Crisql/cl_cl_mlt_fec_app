import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * EmailSendersController — Gestión de bandejas de envío de correo y asignación a compañías.
 *
 * Replica: /emailInbox (Angular EmailInboxComponent — dos tabs)
 *
 * TAB 1 "Bandeja de Correos" (EmailInboxConfigComponent):
 *   - Filtros: Email, SSL (2=Todos/1=Activo/0=Inactivo)
 *   - Tabla: Email, Host, Puerto, SSL, A nombre de (SenderAddress)
 *   - Acciones: Actualizar (edit panel), Visualizar (view panel — form deshabilitado)
 *   - Panel lateral: crear/editar/ver bandeja
 *     - Campos: Email*, Password* (no requerida en edit), SenderAddress, Host*, Port*, SSL
 *     - Correo destinatario de prueba (solo create/edit)
 *     - Botón "Probar credenciales" — Guardar deshabilitado hasta validar
 *
 * TAB 2 "Asignación de Bandejas a Compañías" (EmailInboxAssigmentComponent):
 *   - Autocomplete de compañías activas
 *   - Dos columnas: Asignadas | Disponibles
 *   - Click en ítem para mover entre columnas
 *   - Remover todos / Asignar todos
 *   - Guardar cambios
 *
 * APIs (ApiFEUrl):
 *   POST  /api/EmailConfig/SearchEmailConfig
 *   POST  /api/EmailConfig/CreateEmailConfig
 *   PATCH /api/EmailConfig/UpdateEmailConfig
 *   POST  /api/EmailConfig/ValidateEmailConfig
 *   GET   /api/CompanyEmailConfig/GetEmailInboxesByCompanyId?_companyId=X
 *   POST  /api/EmailConfig/EmailInboxAssignment?_companyId=X
 *
 * APIs (ApiAppUrl):
 *   GET   /api/Companies/GetCompanies?status=active
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,

    // Tabs
    'tabConfig', 'tabAssignment',
    'panelConfig', 'panelAssignment',

    // Toolbar
    'btnCreate', 'btnCreateWrap',

    // TAB 1: Filtros
    // NOTA: el filtro 'filterHost' se eliminó de la vista (ver TODOS.md). El campo Host
    // se sigue enviando en SearchEmailConfig con valor por defecto hasta actualizar el API.
    'filterEmail', 'filterSsl',

    // TAB 1: Tabla — heredado de TabulatorController como 'table'
    'tableLoader',

    // Panel lateral bandeja
    'panel', 'panelBackdrop', 'panelTitle', 'panelActions',
    'saveBtn', 'saveLabel', 'btnValidate', 'validateIcon', 'validateLabel',
    'testEmailField',

    // Campos del formulario de bandeja
    'inputEmail', 'errorEmail', 'errorEmailPattern',
    'inputPassword', 'errorPassword', 'passwordEyeIcon', 'passwordAsterisk',
    'inputSenderAddress',
    'inputHost', 'errorHost',
    'inputPort', 'errorPort',
    'inputSsl',
    'inputTestEmail',

    // TAB 2: Asignación
    'assignCompanyInput', 'assignCompanyDropdown',
    'assignedList', 'availableList',
    'assignedCount', 'availableCount',
    'assignLoader',
  ];

  static values = { ...TabulatorController.values };

  // ── Estado ────────────────────────────────────────────────────────────────

  #companyId    = null;
  #currentTab   = 'config';
  #permissions  = [];

  // Tab 1
  #totalRecords  = 0;        // total real del servidor (evita sobreestimación de Tabulator)
  #editingRecord = null;
  #isEdit       = false;
  #isCredentialsValidated = false;
  #isValidating = false;
  #credentialSnapshot = null; // null en create; objeto en edit — se compara al cambiar campos

  // Tab 2
  #companiesList    = [];          // ICompanyPaginator[]
  #assignedInboxes  = [];          // IEmailConfig[]
  #availableInboxes = [];          // IEmailConfig[]
  #selectedCompanyId = 0;
  #draggedInboxId   = null;
  #draggedFromZone  = null;        // 'available' | 'assigned'

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company   = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;
    this.#permissions = SStore.get('Permissions') || [];

    // Botón "Nueva Bandeja": habilitado solo con permiso; si no, queda
    // deshabilitado con tooltip explicativo (ver CLAUDE.md §26).
    if (this.hasBtnCreateTarget) {
      if (this.#hasPerm('Configurations_EmailInbox_Create')) {
        this.#enableCreateButton();
      } else if (this.hasBtnCreateWrapTarget) {
        this.#attachTooltip(this.btnCreateWrapTarget);
      }
    }

    super.connect();  // inicializa Tabulator; dispara ajaxRequestFunc con page=1 automáticamente
    this.#loadCompanies();
  }

  // ── Configuración Tabulator ────────────────────────────────────────────────

  getTableConfig() {
    // Excluir 'data' y 'maxHeight' del base para que Tabulator entre en modo ajax
    // (si 'data' key existe aunque sea undefined, Tabulator usa modo local y no muestra loader)
    const { data: _d, maxHeight: _m, ...base } = super.getTableConfig();
    return {
      ...base,
      height:    '100%',
      movableRows: false,
      layout: 'fitColumns',
      placeholder: 'No hay bandejas registradas',
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
      // ajaxURL requerido para activar modo remote; el request real lo hace ajaxRequestFunc
      ajaxURL: '/api/EmailConfig/SearchEmailConfig',
      ajaxRequestFunc: (_url, _config, params) => this.#fetchPage(params),
      locale: TABULATOR_LOCALE,
      langs:  TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: { headerSort: false },
      columns: this.getColumns(),
    };
  }

  getColumns() {
    return [
      { title: 'Email',        field: 'Email',         minWidth: 180 },
      { title: 'Host',         field: 'Host',          minWidth: 140 },
      { title: 'Puerto',       field: 'Port',          width: 80  },
      {
        title: 'SSL',
        field: 'SSL',
        width: 80,
        formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive',
          cell.getValue() ? 'Activo' : 'Inactivo'),
      },
      { title: 'A nombre de',  field: 'SenderAddress', minWidth: 160 },
      {
        title: 'Acciones',
        field: '_actions',
        width: 100,
        hozAlign: 'center',
        headerSort: false,
        // Editar sin permiso: deshabilitado + tooltip (CLAUDE.md §26). El
        // data-tooltip va en el <span> envolvente (un <button disabled> no emite
        // eventos de mouse); el setupTooltip base (tabla) lo detecta.
        formatter: () => this.#hasPerm('Configurations_EmailInbox_Update')
          ? `<button type="button" data-action-type="edit" data-tooltip="Actualizar"
                     class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
               <span class="material-icons text-base">edit</span>
             </button>`
          : `<span data-tooltip="No cuenta con permisos para editar bandejas">
               <button type="button" disabled
                       class="p-1.5 text-gray-300 rounded cursor-not-allowed pointer-events-none">
                 <span class="material-icons text-base">edit</span>
               </button>
             </span>`,
        cellClick: (_e, cell) => {
          const btn = _e.target.closest('[data-action-type]');
          if (!btn) return;
          this.#openEditPanel(cell.getRow().getData());
        },
      },
    ];
  }

  // ── Acciones públicas ─────────────────────────────────────────────────────

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.#currentTab = tab;

    // Estilos de tabs
    const activeClass   = ['border-blue-600', 'text-blue-600', 'bg-white'];
    const inactiveClass = ['border-transparent', 'text-gray-500'];

    [this.tabConfigTarget, this.tabAssignmentTarget].forEach(btn => {
      btn.classList.remove(...activeClass, ...inactiveClass);
      btn.classList.add(...inactiveClass);
    });
    event.currentTarget.classList.remove(...inactiveClass);
    event.currentTarget.classList.add(...activeClass);

    if (tab === 'config') {
      this.panelConfigTarget.classList.remove('hidden');
      this.panelAssignmentTarget.classList.add('hidden');
      requestAnimationFrame(() => this.table?.redraw(true));
    } else {
      this.panelConfigTarget.classList.add('hidden');
      this.panelAssignmentTarget.classList.remove('hidden');
    }
  }

  searchConfig() {
    // setData() recarga vía ajaxRequestFunc y vuelve a la página 1
    this.table?.setData();
  }

  openCreatePanel() {
    // Defensa en profundidad: el botón se deshabilita sin permiso, pero
    // reverificamos aquí (ver CLAUDE.md §26).
    if (!this.#hasPerm('Configurations_EmailInbox_Create')) {
      showToast('No cuenta con permisos para crear bandejas.', 'info');
      return;
    }
    this.#editingRecord = null;
    this.#isEdit  = false;
    this.#isCredentialsValidated = false;
    this.#credentialSnapshot = null;
    this.#resetForm();
    this.panelTitleTarget.textContent = 'Nueva bandeja';
    this.#setPanelMode('create');
    this.#openPanel();
  }

  closePanel() {
    this.#closePanel();
  }

  togglePassword() {
    const input = this.inputPasswordTarget;
    const icon  = this.passwordEyeIconTarget;
    input.type  = input.type === 'password' ? 'text' : 'password';
    icon.textContent = input.type === 'password' ? 'visibility_off' : 'visibility';
  }

  async validateCredentials() {
    if (this.#isValidating) return;

    const testEmail = this.inputTestEmailTarget.value.trim();
    const EMAIL_RE  = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$/i;
    if (!testEmail || !EMAIL_RE.test(testEmail)) {
      showToast('Ingrese un correo destinatario válido para la prueba.', 'warning');
      return;
    }

    if (!this.#validateForm()) return;

    this.#isValidating = true;
    this.#isCredentialsValidated = false;
    this.#updateValidateButton(true);
    this.saveBtnTarget.disabled = true;

    try {
      const payload = this.#buildPayload();
      const res = await this.#apiFetch('/api/EmailConfig/ValidateEmailConfig', {
        method: 'POST',
        body: JSON.stringify({ EmailConfig: payload, RecipientEmail: testEmail }),
        headers: { 'API': 'ApiFEUrl' },
      });

      // El endpoint devuelve 200 con { result: false, errorInfo: { Message } } cuando falla
      if (res?.result === false) {
        const msg = res?.errorInfo?.Message || 'Error al validar las credenciales.';
        throw new Error(msg);
      }

      this.#isCredentialsValidated = true;
      this.#credentialSnapshot = this.#getCredentialValues();
      this.#updateValidateButton(false, true);
      this.saveBtnTarget.disabled = false;
      showToast('Credenciales validadas correctamente. Se envió un correo de prueba.', 'success');
    } catch (err) {
      // El endpoint puede devolver el cuerpo JSON crudo como texto del error si responde non-2xx
      let displayMessage = err.message || 'Error al validar las credenciales.';
      try {
        const parsed = JSON.parse(displayMessage);
        if (parsed?.errorInfo?.Message)      displayMessage = parsed.errorInfo.Message;
        else if (parsed?.Message)            displayMessage = parsed.Message;
      } catch { /* no es JSON, usar el mensaje tal cual */ }

      this.#isCredentialsValidated = false;
      this.#updateValidateButton(false, false);
      this.saveBtnTarget.disabled = true;
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al validar', message: displayMessage });
    } finally {
      this.#isValidating = false;
    }
  }

  async save() {
    if (!this.#isCredentialsValidated) {
      showToast('Debe probar las credenciales antes de guardar.', 'warning');
      return;
    }
    if (!this.#validateForm()) return;

    const payload = this.#buildPayload();
    const isCreate = payload.Id === 0;

    try {
      if (isCreate) {
        await this.#apiFetch('/api/EmailConfig/CreateEmailConfig', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'API': 'ApiFEUrl' },
        });
        showToast('Bandeja registrada exitosamente.', 'success');
      } else {
        await this.#apiFetch('/api/EmailConfig/UpdateEmailConfig', {
          method: 'PATCH',
          body: JSON.stringify(payload),
          headers: { 'API': 'ApiFEUrl' },
        });
        showToast('Bandeja actualizada exitosamente.', 'success');
      }
      this.#closePanel();
      this.table?.setData();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al guardar', message: err.message || 'No se pudo guardar la bandeja.' });
    }
  }

  // Llamado por data-action="input/change->email-senders#onCredentialChange"
  // Solo actúa en modo edición; en creación siempre se requiere validar (snapshot=null)
  onCredentialChange() {
    if (!this.#credentialSnapshot) return; // creación — comportamiento existente
    const changed = JSON.stringify(this.#getCredentialValues()) !== JSON.stringify(this.#credentialSnapshot);
    if (changed && this.#isCredentialsValidated) {
      this.#isCredentialsValidated = false;
      this.saveBtnTarget.disabled = true;
      this.#updateValidateButton(false, false);
    } else if (!changed && !this.#isCredentialsValidated) {
      // El usuario revirtió los cambios — volver a habilitar
      this.#isCredentialsValidated = true;
      this.saveBtnTarget.disabled = false;
      this.#updateValidateButton(false, true);
    }
  }

  #getCredentialValues() {
    return {
      email:    this.inputEmailTarget.value.trim(),
      password: this.inputPasswordTarget.value, // vacío en edición = sin cambio
      host:     this.inputHostTarget.value.trim(),
      port:     this.inputPortTarget.value,
      ssl:      this.inputSslTarget.checked,
    };
  }

  // ── Asignación de compañías ───────────────────────────────────────────────

  filterAssignCompanies() {
    const q = this.assignCompanyInputTarget.value.toLowerCase();
    const filtered = this.#companiesList.filter(c =>
      `${c.EmsrIdeNumero}-${c.EmsrNombreComercial}`.toLowerCase().includes(q)
    );
    this.#renderAssignCompanyDropdown(filtered);
  }

  showAssignCompanyDropdown() {
    this.#renderAssignCompanyDropdown(this.#companiesList);
  }

  closeAssignCompanyDropdown() {
    setTimeout(() => this.assignCompanyDropdownTarget.classList.add('hidden'), 150);
  }

  onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
  }

  onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');

    const targetZone = event.currentTarget.dataset.dropZone;
    if (!this.#draggedInboxId || this.#draggedFromZone === targetZone) return;

    const id = this.#draggedInboxId;

    if (targetZone === 'assigned') {
      const idx = this.#availableInboxes.findIndex(i => i.Id === id);
      if (idx !== -1) this.#assignedInboxes.push(...this.#availableInboxes.splice(idx, 1));
    } else {
      const idx = this.#assignedInboxes.findIndex(i => i.Id === id);
      if (idx !== -1) this.#availableInboxes.push(...this.#assignedInboxes.splice(idx, 1));
    }

    this.#draggedInboxId  = null;
    this.#draggedFromZone = null;
    this.#renderAssignmentLists();
  }

  onDragLeave(event) {
    event.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
  }

  removeAll() {
    this.#availableInboxes.push(...this.#assignedInboxes);
    this.#assignedInboxes = [];
    this.#renderAssignmentLists();
  }

  assignAll() {
    this.#assignedInboxes.push(...this.#availableInboxes);
    this.#availableInboxes = [];
    this.#renderAssignmentLists();
  }

  async saveAssignment() {
    if (!this.#selectedCompanyId) {
      showToast('Seleccione una compañía antes de guardar.', 'warning');
      return;
    }
    this.#showAssignLoader();
    try {
      await this.#apiFetch(`/api/EmailConfig/EmailInboxAssignment?_companyId=${this.#selectedCompanyId}`, {
        method: 'POST',
        body: JSON.stringify(this.#assignedInboxes),
        headers: { 'API': 'ApiFEUrl' },
      });
      showToast('Bandejas asignadas exitosamente.', 'success');
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al guardar', message: err.message || 'No se pudieron guardar las asignaciones.' });
    } finally {
      this.#hideAssignLoader();
    }
  }

  // ── Métodos privados: datos ───────────────────────────────────────────────

  async #loadCompanies() {
    try {
      const data = await this.#apiFetch('/api/Companies/GetCompanies?status=active');
      this.#companiesList = data.Data || [];
    } catch (_) { /* no bloquear */ }
  }

  /**
   * Función de carga remota para Tabulator.
   * @param {Object} params  { page (1-indexed), size, ... }
   * @returns {Promise<{data: Array, last_page: number}>}
   */
  async #fetchPage(params) {
    const page = params.page || 1;
    const size = params.size || 5;

    const payload = {
      Email:    this.filterEmailTarget.value.trim(),
      // El filtro Host se eliminó de la vista — se envía vacío (= todos) por defecto.
      // TODO (TODOS.md): quitar este campo del payload cuando el API deje de requerirlo.
      Host:     '',
      SSL:      this.filterSslTarget.value,
      StartPos: page,
      StepPos:  size,
    };

    try {
      const data = await this.#apiFetch('/api/EmailConfig/SearchEmailConfig', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'API': 'ApiFEUrl' },
      });

      const records = data.emailConfigList || [];
      const total   = data.maxQuantityRows ?? records[0]?.maxQuantityRows ?? 0;
      this.#totalRecords = total;
      const lastPage = Math.max(1, Math.ceil(total / size));
      return { data: records, last_page: lastPage };
    } catch (err) {
      showToast(err.message || 'Error al buscar las bandejas.', 'error');
      return { data: [], last_page: 1 };
    }
  }

  async #loadInboxesByCompany(companyId) {
    this.#selectedCompanyId = companyId;
    this.#showAssignLoader();
    try {
      const data = await this.#apiFetch(
        `/api/CompanyEmailConfig/GetEmailInboxesByCompanyId?_companyId=${companyId}`,
        { headers: { 'API': 'ApiFEUrl' } }
      );
      this.#assignedInboxes  = data.ListEmailInboxesAssigned    || [];
      this.#availableInboxes = data.ListEmailInboxesNotAssigned || [];
      this.#renderAssignmentLists();
    } catch (err) {
      showToast(err.message || 'Error al obtener las bandejas de la compañía.', 'error');
    } finally {
      this.#hideAssignLoader();
    }
  }

  #showAssignLoader() {
    if (this.hasAssignLoaderTarget) this.assignLoaderTarget.classList.remove('hidden');
  }

  #hideAssignLoader() {
    if (this.hasAssignLoaderTarget) this.assignLoaderTarget.classList.add('hidden');
  }

  // ── Métodos privados: panel lateral ──────────────────────────────────────

  #openEditPanel(row) {
    if (!this.#hasPerm('Configurations_EmailInbox_Update')) {
      showToast('No cuenta con permisos para editar bandejas.', 'info');
      return;
    }
    this.#editingRecord = row;
    this.#isEdit  = true;
    this.#isCredentialsValidated = true; // ya validadas en el servidor — habilitar save
    this.#resetForm();
    this.panelTitleTarget.textContent = 'Modificar bandeja';

    this.inputEmailTarget.value         = row.Email         || '';
    this.inputPasswordTarget.value      = '';
    this.inputSenderAddressTarget.value = row.SenderAddress  || '';
    this.inputHostTarget.value          = row.Host          || '';
    this.inputPortTarget.value          = row.Port          || '';
    this.inputSslTarget.checked         = !!row.SSL;

    // Capturar snapshot tras poblar el form — cualquier cambio en estos campos
    // invalida las credenciales y obliga a re-validar
    this.#credentialSnapshot = this.#getCredentialValues();

    this.#setPanelMode('edit');
    this.#openPanel();
  }

  #setPanelMode(mode) {
    // mode: 'create' | 'edit'
    this.panelActionsTarget.classList.remove('hidden');
    this.testEmailFieldTarget.classList.remove('hidden');
    this.saveLabelTarget.textContent = mode === 'create' ? 'Crear' : 'Modificar';
    this.passwordAsteriskTarget.classList.toggle('hidden', mode === 'edit');
    // En edición el save ya está habilitado (credenciales ya válidas en servidor);
    // en creación permanece deshabilitado hasta validar
    this.saveBtnTarget.disabled = !this.#isCredentialsValidated;
    this.#updateValidateButton(false, this.#isCredentialsValidated);
  }

  #openPanel() {
    this.panelBackdropTarget.classList.remove('hidden');
    this.panelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  #closePanel() {
    this.panelTarget.classList.add('translate-x-full');
    this.panelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
    this.#editingRecord = null;
    this.#isEdit = false;
    this.#isCredentialsValidated = false;
    this.#credentialSnapshot = null;
  }

  #resetForm() {
    this.inputEmailTarget.value         = '';
    this.inputPasswordTarget.value      = '';
    this.inputPasswordTarget.type       = 'password';
    this.passwordEyeIconTarget.textContent = 'visibility_off';
    this.inputSenderAddressTarget.value = '';
    this.inputHostTarget.value          = '';
    this.inputPortTarget.value          = '';
    this.inputSslTarget.checked         = false;
    this.inputTestEmailTarget.value     = '';
    this.#clearErrors();
  }

  // ── Métodos privados: validación ─────────────────────────────────────────

  #validateForm() {
    this.#clearErrors();
    let valid = true;
    const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$/i;

    if (!this.inputEmailTarget.value.trim()) {
      this.errorEmailTarget.classList.remove('hidden'); valid = false;
    } else if (!EMAIL_RE.test(this.inputEmailTarget.value)) {
      this.errorEmailPatternTarget.classList.remove('hidden'); valid = false;
    }

    const isCreate = !this.#editingRecord;
    if (isCreate && !this.inputPasswordTarget.value) {
      this.errorPasswordTarget.classList.remove('hidden'); valid = false;
    }

    if (!this.inputHostTarget.value.trim()) {
      this.errorHostTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.inputPortTarget.value) {
      this.errorPortTarget.classList.remove('hidden'); valid = false;
    }

    if (!valid) showToast('Favor completar los espacios requeridos.', 'warning');
    return valid;
  }

  #clearErrors() {
    ['errorEmail', 'errorEmailPattern', 'errorPassword', 'errorHost', 'errorPort']
      .forEach(t => { if (this[`${t}Target`]) this[`${t}Target`].classList.add('hidden'); });
  }

  #buildPayload() {
    return {
      Id:                          this.#editingRecord?.Id || 0,
      Email:                       this.inputEmailTarget.value.trim(),
      Password:                    this.inputPasswordTarget.value || '',
      SenderAddress:               this.inputSenderAddressTarget.value.trim(),
      Host:                        this.inputHostTarget.value.trim(),
      Port:                        parseInt(this.inputPortTarget.value) || 0,
      SSL:                         this.inputSslTarget.checked,
      ActiveMailsService:          false,
      ActiveReceptMailsService:    false,
      LastAttemptMailsService:     new Date().toISOString(),
      LastAttemptReceptMailsService: new Date().toISOString(),
    };
  }

  // ── Métodos privados: UI helpers ─────────────────────────────────────────

  #updateValidateButton(validating = false, validated = false) {
    const icon  = this.validateIconTarget;
    const label = this.validateLabelTarget;
    if (validating) {
      icon.textContent  = 'hourglass_empty';
      label.textContent = 'Probando...';
      this.btnValidateTarget.disabled = true;
    } else if (validated) {
      icon.textContent  = 'check_circle';
      label.textContent = 'Credenciales verificadas';
      this.btnValidateTarget.disabled = false;
    } else {
      icon.textContent  = 'wifi_tethering';
      label.textContent = 'Probar credenciales';
      this.btnValidateTarget.disabled = false;
    }
  }

  #renderAssignCompanyDropdown(list) {
    const dropdown = this.assignCompanyDropdownTarget;
    dropdown.innerHTML = '';
    if (!list.length) { dropdown.classList.add('hidden'); return; }

    list.slice(0, 50).forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.EmsrIdeNumero}-${c.EmsrNombreComercial}`;
      li.className   = 'px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm';
      li.addEventListener('mousedown', () => {
        this.assignCompanyInputTarget.value = `${c.EmsrIdeNumero}-${c.EmsrNombreComercial}`;
        dropdown.classList.add('hidden');
        this.#loadInboxesByCompany(c.Id);
      });
      dropdown.appendChild(li);
    });
    dropdown.classList.remove('hidden');
  }

  #renderAssignmentLists() {
    this.assignedCountTarget.textContent  = this.#assignedInboxes.length;
    this.availableCountTarget.textContent = this.#availableInboxes.length;

    this.#renderInboxList(this.assignedListTarget,  this.#assignedInboxes,  'assigned',
      `<div class="flex flex-col items-center justify-center h-full text-gray-400 py-10">
         <span class="material-icons text-5xl opacity-40 mb-3">inbox</span>
         <p class="text-xs">Sin bandejas asignadas</p>
       </div>`);

    this.#renderInboxList(this.availableListTarget, this.#availableInboxes, 'available',
      `<div class="flex flex-col items-center justify-center h-full text-gray-400 py-10">
         <span class="material-icons text-5xl opacity-40 mb-3">check_circle</span>
         <p class="text-xs">Todas las bandejas están asignadas</p>
       </div>`);
  }

  #renderInboxList(container, inboxes, zone, emptyHtml) {
    container.innerHTML = inboxes.length ? '' : emptyHtml;
    inboxes.forEach(inbox => {
      const isAssigned = zone === 'assigned';
      const div = document.createElement('div');
      div.dataset.inboxId = inbox.Id;
      div.draggable = true;
      div.className = [
        'flex items-center gap-3 p-3 mb-2 bg-white border border-gray-200 rounded-lg cursor-move',
        'transition-all hover:shadow-md hover:-translate-y-0.5',
        isAssigned ? 'border-l-4 border-l-green-400' : '',
      ].join(' ');
      div.innerHTML = `
        <div class="text-gray-400 cursor-grab flex-shrink-0">
          <span class="material-icons text-xl">drag_indicator</span>
        </div>
        <div class="flex flex-col flex-1 gap-0.5 min-w-0">
          <span class="font-medium text-gray-800 text-sm truncate">${inbox.Email}</span>
          <span class="text-xs text-gray-400">#${inbox.Id}</span>
        </div>`;
      div.addEventListener('dragstart', () => {
        this.#draggedInboxId  = inbox.Id;
        this.#draggedFromZone = zone;
        div.classList.add('opacity-50');
      });
      div.addEventListener('dragend', () => {
        div.classList.remove('opacity-50');
      });
      container.appendChild(div);
    });
  }

  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  // Habilita el botón "Nueva Bandeja" (nace deshabilitado/gris con tooltip de
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

  #statusBadge(status, labelOverride = null) {
    const map = {
      active:   { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'   },
      inactive: { bg: '#fdecea', color: '#c0392b', label: 'Inactivo' },
    };
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    return `<span style="background-color:${bg}; color:${color};"
                 class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${labelOverride ?? label}
    </span>`;
  }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  // ── Fetch helper ─────────────────────────────────────────────────────────

  async #apiFetch(url, options = {}) {
    const isFESync  = (options.headers?.['API'] ?? 'ApiAppUrl') === 'ApiFEUrl';

    // ApiFEUrl (servidor Sync/FE) usa su propio token almacenado en sessionStorage.currentFEUser
    // ApiAppUrl (servidor App)    usa el token principal de sesión en localStorage.Session
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

    const hasBody = response.status !== 204 &&
                    response.headers.get('content-length') !== '0' &&
                    response.headers.get('content-type')?.includes('application/json');
    if (!hasBody) return { Message: decodedMessage || null };

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
