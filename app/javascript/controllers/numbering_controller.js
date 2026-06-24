import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { TabulatorFull } from 'tabulator-tables';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';
import { docTypeDescription } from 'controllers/create_document_constants';

/**
 * NumberingController — Configuración de Numeración y Numeración de Recepción.
 *
 * Replica Angular NumberingConfigComponent (dos sub-secciones):
 *
 * SECCIÓN 1 — Numeración (NumberingComponent):
 *   - GET /api/Numbering?companyId={id}
 *   - GET /api/Sucursal/GetSucursalByCompany?companyId={id}
 *   - GET /api/Numbering/GetReceptNumberingByCompany?companyId={id}
 *   - Tabla: Tipo de Integración, Tipo de Documento, Número Siguiente, Observación, Sucursal, Terminal, Activo
 *   - Crear / Editar (DocType + SucursalId + Terminal deshabilitados en edición)
 *   - POST /api/Numbering/ | PATCH /api/Numbering/
 *
 * SECCIÓN 2 — Numeración de Recepción (ReceptionNumberingComponent):
 *   - Tabla: Tipo de Integración, Número Siguiente, Sucursal, Terminal, Observación, Activo
 *   - Crear (NextNumber deshabilitado) / Editar (SucursalId + Terminal deshabilitados)
 *   - POST /api/Numbering/PostReceptNumbering/ | PATCH /api/Numbering/PatchReceptNumbering/
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,

    // Secciones colapsables
    'numberingCard', 'numberingSection', 'numberingChevron',
    'receptionCard', 'receptionSection', 'receptionChevron',

    // Tablas
    'numberingTable', 'receptionTable',

    // Loaders (vista completa para carga inicial combinada; por sección para reloads)
    'viewLoader', 'numberingLoader', 'receptionLoader',

    // Panel Numeración
    'numberingPanel', 'numberingPanelBackdrop', 'numberingPanelTitle',
    'numNextNumber', 'numNextNumberError',
    'numDocType',    'numDocTypeError',
    'numSucursal',   'numSucursalError',
    'numTerminal',   'numTerminalError',
    'numObvs',       'numObvsError',
    'numIntegration','numIntegrationError',
    'numActive',     'numActiveLabel',
    'numSaveBtn',    'numSaveIcon', 'numSaveLabel',

    // Panel Recepción
    'receptionPanel', 'receptionPanelBackdrop', 'receptionPanelTitle',
    'recNextNumber', 'recNextNumberError',
    'recSucursal',   'recSucursalError',
    'recTerminal',   'recTerminalError',
    'recObvs',       'recObvsError',
    'recIntegration','recIntegrationError',
    'recActive',     'recActiveLabel',
    'recSaveBtn',    'recSaveIcon', 'recSaveLabel',

  ];

  static values = { ...TabulatorController.values };

  // ── Estado ────────────────────────────────────────────────────────────────

  #companyId    = null;
  #sucursalList = [];
  #numTable     = null;
  #recTable     = null;
  #editingNum   = null;   // null = crear, objeto = editar
  #editingRec   = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company   = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    this.#numTable = this.#buildTable(this.numberingTableTarget, this.#numColumns());
    this.#recTable = this.#buildTable(this.receptionTableTarget, this.#recColumns());

    this.#loadInitialData();
  }

  disconnect() {
    this.#numTable?.destroy();
    this.#recTable?.destroy();
  }

  // ── Construcción de tablas (síncronas) ────────────────────────────────────

  #buildTable(el, columns) {
    return new TabulatorFull(el, {
      height:    '100%',   // ocupa el contenedor (h-full + flex-1 min-h-0 en el padre)
      layout:    'fitColumns',
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [10, 20, 50],
      paginationCounter: 'rows',
      locale:    TABULATOR_LOCALE,
      langs:     TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      placeholder: 'No hay registros',
      columnDefaults: { headerSort: false },
      columns,
    });
  }

  #numColumns() {
    return [
      { title: 'Tipo de Integración', field: 'IntegrationClm', widthGrow: 1 },
      {
        title: 'Tipo de Documento', field: 'DocType', widthGrow: 1,
        formatter: (cell) => docTypeDescription(cell.getValue()),
      },
      { title: 'Número Siguiente',    field: 'NextNumber',     widthGrow: 1 },
      { title: 'Observación',         field: 'Obvs',           widthGrow: 2 },
      { title: 'Sucursal',            field: 'SucursalNum',    widthGrow: 1 },
      { title: 'Terminal',            field: 'Terminal',       widthGrow: 1 },
      {
        title: 'Estado', field: 'Active', width: 110,
        formatter: (cell) => this.#statusBadge(cell.getValue()),
      },
      {
        title: 'Acciones', field: 'Id', width: 100, hozAlign: 'center',
        formatter: () => this.#editButton(),
        cellClick: (_e, cell) => {
          if (_e.target.closest('[data-action-type="edit"]')) {
            this.#openEditNum(cell.getRow().getData());
          }
        },
      },
    ];
  }

  #recColumns() {
    return [
      { title: 'Tipo de Integración', field: 'IntegrationClm', widthGrow: 1 },
      { title: 'Número Siguiente',    field: 'NextNumber',     widthGrow: 1 },
      { title: 'Sucursal',            field: 'SucursalNum',    widthGrow: 1 },
      { title: 'Terminal',            field: 'Terminal',       widthGrow: 1 },
      { title: 'Observación',         field: 'Obvs',           widthGrow: 2 },
      {
        title: 'Estado', field: 'Active', width: 110,
        formatter: (cell) => this.#statusBadge(cell.getValue()),
      },
      {
        title: 'Acciones', field: 'Id', width: 100, hozAlign: 'center',
        formatter: () => this.#editButton(),
        cellClick: (_e, cell) => {
          if (_e.target.closest('[data-action-type="edit"]')) {
            this.#openEditRec(cell.getRow().getData());
          }
        },
      },
    ];
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────

  #showLoader(el) { el?.classList.remove('hidden'); }
  #hideLoader(el) { el?.classList.add('hidden'); }

  async #loadInitialData() {
    const loader = this.hasViewLoaderTarget ? this.viewLoaderTarget : null;
    this.#showLoader(loader);
    try {
      const [numRes, sucRes, recRes] = await Promise.all([
        this.#apiFetch(`/api/Numbering?companyId=${this.#companyId}`),
        this.#apiFetch(`/api/Sucursal/GetSucursalByCompany?companyId=${this.#companyId}`),
        this.#apiFetch(`/api/Numbering/GetReceptNumberingByCompany?companyId=${this.#companyId}`),
      ]);

      this.#sucursalList = sucRes.Data || [];
      this.#populateSucursalSelects();

      this.#numTable?.setData((numRes.Data || []).map(x => this.#mapNum(x)));
      this.#recTable?.setData((recRes.Data || []).map(x => this.#mapRec(x)));

      if (!numRes.Data?.length || !recRes.Data?.length) {
        const msg = numRes.Message || recRes.Message;
        if (msg) showToast(msg, 'warning');
      }
    } catch (err) {
      showToast(err.message || 'Error al cargar la información de numeración.', 'error');
    } finally {
      this.#hideLoader(loader);
    }
  }

  async #reloadNum() {
    const loader = this.hasNumberingLoaderTarget ? this.numberingLoaderTarget : null;
    this.#showLoader(loader);
    try {
      const [numRes, sucRes] = await Promise.all([
        this.#apiFetch(`/api/Numbering?companyId=${this.#companyId}`),
        this.#apiFetch(`/api/Sucursal/GetSucursalByCompany?companyId=${this.#companyId}`),
      ]);
      this.#sucursalList = sucRes.Data || [];
      this.#populateSucursalSelects();
      this.#numTable?.setData((numRes.Data || []).map(x => this.#mapNum(x)));
    } catch (err) {
      showToast(err.message || 'Error al recargar numeración.', 'error');
    } finally {
      this.#hideLoader(loader);
    }
  }

  async #reloadRec() {
    const loader = this.hasReceptionLoaderTarget ? this.receptionLoaderTarget : null;
    this.#showLoader(loader);
    try {
      const res = await this.#apiFetch(`/api/Numbering/GetReceptNumberingByCompany?companyId=${this.#companyId}`);
      this.#recTable?.setData((res.Data || []).map(x => this.#mapRec(x)));
    } catch (err) {
      showToast(err.message || 'Error al recargar numeración de recepción.', 'error');
    } finally {
      this.#hideLoader(loader);
    }
  }

  // ── Mapeo de filas ─────────────────────────────────────────────────────────

  #mapNum(x) {
    return {
      ...x,
      IntegrationClm: x.Integration === 1 ? 'Integrador' : 'AppFE',
      SucursalNum: this.#sucursalList.find(s => s.Id === x.SucursalId)?.SucursalNum ?? x.SucursalId,
    };
  }

  #mapRec(x) {
    return {
      ...x,
      IntegrationClm: x.Integration === 1 ? 'Integrador' : 'AppFE',
      SucursalNum: this.#sucursalList.find(s => s.Id === x.SucursalId)?.SucursalNum ?? x.SucursalId,
    };
  }

  // ── Selects de sucursal ────────────────────────────────────────────────────

  #populateSucursalSelects() {
    const opts = this.#sucursalList
      .map(s => `<option value="${s.Id}">${s.SucursalNum}${s.Alias ? ' - ' + s.Alias : ''}</option>`)
      .join('');
    const base = `<option value="">-- Seleccione --</option>${opts}`;

    [this.numSucursalTarget, this.recSucursalTarget].forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = base;
      if (prev) sel.value = prev;
    });
  }

  // ── Toggle secciones colapsables ──────────────────────────────────────────

  toggleNumbering() {
    const collapsed = this.numberingSectionTarget.classList.toggle('hidden');
    this.numberingChevronTarget.classList.toggle('rotate-180', !collapsed);
    // El card ocupa espacio cuando está expandido, se comprime cuando está colapsado
    this.numberingCardTarget.classList.toggle('flex-1',   !collapsed);
    this.numberingCardTarget.classList.toggle('min-h-0',  !collapsed);
    this.numberingCardTarget.classList.toggle('flex-shrink-0', collapsed);
  }

  toggleReception() {
    const collapsed = this.receptionSectionTarget.classList.toggle('hidden');
    this.receptionChevronTarget.classList.toggle('rotate-180', !collapsed);
    this.receptionCardTarget.classList.toggle('flex-1',   !collapsed);
    this.receptionCardTarget.classList.toggle('min-h-0',  !collapsed);
    this.receptionCardTarget.classList.toggle('flex-shrink-0', collapsed);
    // Tabulator no puede calcular altura dentro de un elemento hidden;
    // forzamos redibujado en el siguiente frame de animación
    if (!collapsed) requestAnimationFrame(() => this.#recTable?.redraw(true));
  }

  // ── Panel Numeración ───────────────────────────────────────────────────────

  openCreateNumbering() {
    this.#editingNum = null;
    this.#resetNumPanel();
    this.numberingPanelTitleTarget.textContent = 'Nueva Numeración';
    this.numSaveIconTarget.textContent         = 'check';
    this.numSaveLabelTarget.textContent        = 'Crear';

    // Todos los campos habilitados al crear
    this.numNextNumberTarget.disabled = false;
    this.numDocTypeTarget.disabled    = false;
    this.numSucursalTarget.disabled   = false;
    this.numTerminalTarget.disabled   = false;

    this.#openPanel(this.numberingPanelTarget, this.numberingPanelBackdropTarget);
  }

  #openEditNum(row) {
    this.#editingNum = row;
    this.#resetNumPanel();
    this.numberingPanelTitleTarget.textContent = 'Editar Numeración';
    this.numSaveIconTarget.textContent         = 'autorenew';
    this.numSaveLabelTarget.textContent        = 'Modificar';

    // DocType, SucursalId y Terminal deshabilitados al editar
    this.numNextNumberTarget.disabled = false;
    this.numDocTypeTarget.disabled    = true;
    this.numSucursalTarget.disabled   = true;
    this.numTerminalTarget.disabled   = true;

    this.numNextNumberTarget.value   = row.NextNumber;
    this.numDocTypeTarget.value      = row.DocType;
    this.numSucursalTarget.value     = row.SucursalId;
    this.numTerminalTarget.value     = row.Terminal;
    this.numObvsTarget.value         = row.Obvs;
    this.numIntegrationTarget.value  = row.Integration;
    this.numActiveTarget.checked     = row.Active;
    this.numActiveLabelTarget.textContent = row.Active ? 'Activo' : 'Inactivo';

    this.#openPanel(this.numberingPanelTarget, this.numberingPanelBackdropTarget);
  }

  closeNumberingPanel() {
    this.#closePanel(this.numberingPanelTarget, this.numberingPanelBackdropTarget);
  }

  async saveNumbering() {
    if (!this.#validateNumPanel()) return;

    this.numSaveBtnTarget.disabled = true;
    try {
      if (this.#editingNum) {
        const patch = {
          id:          this.#editingNum.Id,
          companyId:   this.#companyId,
          nextNumber:  parseInt(this.numNextNumberTarget.value),
          sucursalId:  parseInt(this.numSucursalTarget.value),
          terminal:    parseInt(this.numTerminalTarget.value),
          docType:     this.numDocTypeTarget.value,
          obvs:        this.numObvsTarget.value.trim(),
          active:      this.numActiveTarget.checked,
          integration: parseInt(this.numIntegrationTarget.value),
        };
        await this.#apiFetch('/api/Numbering/', { method: 'PATCH', body: JSON.stringify(patch) });
        showToast('Numeración actualizada exitosamente.', 'success');
      } else {
        const post = {
          Id:          0,
          CompanyId:   this.#companyId,
          NextNumber:  parseInt(this.numNextNumberTarget.value),
          DocType:     this.numDocTypeTarget.value,
          SucursalId:  parseInt(this.numSucursalTarget.value),
          Terminal:    parseInt(this.numTerminalTarget.value),
          Obvs:        this.numObvsTarget.value.trim(),
          Active:      this.numActiveTarget.checked,
          Integration: parseInt(this.numIntegrationTarget.value),
        };
        await this.#apiFetch('/api/Numbering/', { method: 'POST', body: JSON.stringify(post) });
        showToast('Numeración registrada exitosamente.', 'success');
      }
      this.closeNumberingPanel();
      await this.#reloadNum();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: `Error al ${this.#editingNum ? 'actualizar' : 'registrar'} la numeración`, message: err.message });
    } finally {
      this.numSaveBtnTarget.disabled = false;
    }
  }

  #validateNumPanel() {
    const checks = [
      { el: this.numNextNumberTarget,  err: this.numNextNumberErrorTarget,  ok: v => v !== '' && parseInt(v) >= 1 },
      { el: this.numDocTypeTarget,     err: this.numDocTypeErrorTarget,     ok: v => v !== '' },
      { el: this.numSucursalTarget,    err: this.numSucursalErrorTarget,    ok: v => v !== '' },
      { el: this.numTerminalTarget,    err: this.numTerminalErrorTarget,    ok: v => v !== '' && parseInt(v) >= 0 },
      { el: this.numObvsTarget,        err: this.numObvsErrorTarget,        ok: v => v.trim() !== '' },
      { el: this.numIntegrationTarget, err: this.numIntegrationErrorTarget, ok: v => v !== '' },
    ];
    let valid = true;
    for (const { el, err, ok } of checks) {
      if (el.disabled) { err.classList.add('hidden'); continue; }
      const pass = ok(el.value);
      err.classList.toggle('hidden', pass);
      if (!pass) valid = false;
    }
    return valid;
  }

  #resetNumPanel() {
    this.numNextNumberTarget.value  = 1;
    this.numDocTypeTarget.value     = '';
    this.numSucursalTarget.value    = '';
    this.numTerminalTarget.value    = '';
    this.numObvsTarget.value        = '';
    this.numIntegrationTarget.value = '';
    this.numActiveTarget.checked    = true;
    this.numActiveLabelTarget.textContent = 'Activo';
    [
      this.numNextNumberErrorTarget, this.numDocTypeErrorTarget,
      this.numSucursalErrorTarget,   this.numTerminalErrorTarget,
      this.numObvsErrorTarget,       this.numIntegrationErrorTarget,
    ].forEach(e => e.classList.add('hidden'));
  }

  // ── Panel Recepción ────────────────────────────────────────────────────────

  openCreateReception() {
    this.#editingRec = null;
    this.#resetRecPanel();
    this.receptionPanelTitleTarget.textContent = 'Nueva Numeración de Recepción';
    this.recSaveIconTarget.textContent         = 'check';
    this.recSaveLabelTarget.textContent        = 'Crear';

    // NextNumber deshabilitado al crear; Sucursal y Terminal habilitados
    this.recNextNumberTarget.disabled = true;
    this.recSucursalTarget.disabled   = false;
    this.recTerminalTarget.disabled   = false;

    this.#openPanel(this.receptionPanelTarget, this.receptionPanelBackdropTarget);
  }

  #openEditRec(row) {
    this.#editingRec = row;
    this.#resetRecPanel();
    this.receptionPanelTitleTarget.textContent = 'Editar Numeración de Recepción';
    this.recSaveIconTarget.textContent         = 'autorenew';
    this.recSaveLabelTarget.textContent        = 'Modificar';

    // NextNumber habilitado; Sucursal y Terminal deshabilitados al editar
    this.recNextNumberTarget.disabled = false;
    this.recSucursalTarget.disabled   = true;
    this.recTerminalTarget.disabled   = true;

    this.recNextNumberTarget.value   = row.NextNumber;
    this.recSucursalTarget.value     = row.SucursalId;
    this.recTerminalTarget.value     = row.Terminal;
    this.recObvsTarget.value         = row.Obvs;
    this.recIntegrationTarget.value  = row.Integration;
    this.recActiveTarget.checked     = row.Active;
    this.recActiveLabelTarget.textContent = row.Active ? 'Activo' : 'Inactivo';

    this.#openPanel(this.receptionPanelTarget, this.receptionPanelBackdropTarget);
  }

  closeReceptionPanel() {
    this.#closePanel(this.receptionPanelTarget, this.receptionPanelBackdropTarget);
  }

  async saveReception() {
    if (!this.#validateRecPanel()) return;

    this.recSaveBtnTarget.disabled = true;
    try {
      const payload = {
        Id:          this.#editingRec ? this.#editingRec.Id : 0,
        CompanyId:   this.#companyId,
        NextNumber:  parseInt(this.recNextNumberTarget.value) || 0,
        SucursalId:  parseInt(this.recSucursalTarget.value),
        Terminal:    parseInt(this.recTerminalTarget.value),
        Message:     1,
        Obvs:        this.recObvsTarget.value.trim(),
        Integration: parseInt(this.recIntegrationTarget.value),
        Active:      this.recActiveTarget.checked,
      };

      if (this.#editingRec) {
        await this.#apiFetch('/api/Numbering/PatchReceptNumbering/', { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Numeración de Recepción actualizada exitosamente.', 'success');
      } else {
        await this.#apiFetch('/api/Numbering/PostReceptNumbering/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Numeración de Recepción registrada exitosamente.', 'success');
      }
      this.closeReceptionPanel();
      await this.#reloadRec();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: `Error al ${this.#editingRec ? 'actualizar' : 'registrar'} la numeración de recepción`, message: err.message });
    } finally {
      this.recSaveBtnTarget.disabled = false;
    }
  }

  #validateRecPanel() {
    const checks = [
      { el: this.recNextNumberTarget,  err: this.recNextNumberErrorTarget,  ok: v => v !== '' && parseInt(v) >= 1 },
      { el: this.recSucursalTarget,    err: this.recSucursalErrorTarget,    ok: v => v !== '' },
      { el: this.recTerminalTarget,    err: this.recTerminalErrorTarget,    ok: v => v !== '' },
      { el: this.recObvsTarget,        err: this.recObvsErrorTarget,        ok: v => v.trim() !== '' },
      { el: this.recIntegrationTarget, err: this.recIntegrationErrorTarget, ok: v => v !== '' },
    ];
    let valid = true;
    for (const { el, err, ok } of checks) {
      if (el.disabled) { err.classList.add('hidden'); continue; }
      const pass = ok(el.value);
      err.classList.toggle('hidden', pass);
      if (!pass) valid = false;
    }
    return valid;
  }

  #resetRecPanel() {
    this.recNextNumberTarget.value  = 1;
    this.recSucursalTarget.value    = '';
    this.recTerminalTarget.value    = '';
    this.recObvsTarget.value        = '';
    this.recIntegrationTarget.value = '';
    this.recActiveTarget.checked    = true;
    this.recActiveLabelTarget.textContent = 'Activo';
    [
      this.recNextNumberErrorTarget, this.recSucursalErrorTarget,
      this.recTerminalErrorTarget,   this.recObvsErrorTarget,
      this.recIntegrationErrorTarget,
    ].forEach(e => e.classList.add('hidden'));
  }

  // ── Helpers de panel ──────────────────────────────────────────────────────

  #openPanel(panel, backdrop) {
    backdrop.classList.remove('hidden');
    panel.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  #closePanel(panel, backdrop) {
    panel.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  #statusBadge(active) {
    return active
      ? `<span style="background-color:#e8f5ee; color:#3a7d52;"
               class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Activo</span>`
      : `<span style="background-color:#fdecea; color:#c0392b;"
               class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Inactivo</span>`;
  }

  #editButton() {
    return `
      <button type="button" data-action-type="edit" data-tooltip="Editar"
              class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
        <span class="material-icons text-base">edit</span>
      </button>`;
  }

  // ── apiFetch ───────────────────────────────────────────────────────────────

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

    const clMessage      = response.headers.get('cl-message');
    const decodedMessage = clMessage ? (() => {
      try { return decodeURIComponent(clMessage); } catch { return clMessage; }
    })() : null;

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(decodedMessage || text || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) return {};

    const text = await response.text();
    if (!text?.trim()) return {};
    const json = JSON.parse(text);
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
