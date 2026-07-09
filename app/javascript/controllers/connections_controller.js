import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * ConnectionsController — Lista + búsqueda de conexiones SAP (Tabulator) y
 * panel lateral de creación/edición.
 *
 * Replica: Angular ConnectionsComponent + CreateOrUpdateConnectionComponent.
 *   - GET /api/Connections?server=&apiUrl=  (paginado vía headers)
 *   - GET /api/Connections/:id              (cargar para editar)
 *   - POST /api/Connections                 (crear)
 *   - PATCH /api/Connections                (actualizar)
 *
 * Crear/editar ya NO navega a otra vista: abre un panel lateral derecho
 * (patrón de CLAUDE.md §8, copiado del panel "Nueva Conexión SAP" del form de
 * compañías). Al guardar con éxito se cierra el panel y se refresca la tabla,
 * sin recargar la página.
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
    'btnCreate', 'btnCreateWrap',
    // Panel lateral
    'panel', 'panelBackdrop', 'panelTitle',
    'fServer', 'fServerError',
    'fLicenseServer',
    'fApiUrl', 'fApiUrlError',
    'fCrystalApiUrl',
    'fOdbcType', 'fOdbcTypeError',
    'fDbEngine', 'fDbEngineError',
    'fServerType', 'fServerTypeError', 'fServerTypeHint',
    'fDbUser', 'fDbUserError', 'fDbUserRequired',
    'fDbPass', 'fDbPassError', 'fDbPassRequired', 'fDbPassHint',
    'fBoSuppLangs',
    'fDst',
    'fUseTrusted',
    'togglePassIcon',
    'submitBtn', 'submitIcon', 'submitLabel',
  ];

  static values = { ...TabulatorController.values };

  #permissions = [];
  #totalRecords = 0;        // total real del servidor (evita sobreestimación de Tabulator)
  #connectionId = 0;        // 0 = crear; >0 = editar
  #editMode = false;
  #passVisible = false;

  // Descripción por valor de "Tipo de Servidor". El sufijo "T" indica conexión de
  // confianza (Trusted / autenticación de Windows). Los valores HANA arman el
  // connectionString para SAP HANA Studio; los SQL arman el de SQL Server.
  #serverTypeHints = {
    SQLSERVERT:  'SQL Server con conexión de confianza (autenticación de Windows / Trusted).',
    HANASERVER:  'SAP HANA con autenticación estándar (usuario y contraseña).',
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    const perms = SStore.get('Permissions');
    this.#permissions = Array.isArray(perms) ? perms : [];

    // Botón "Nueva Conexión": habilitado solo con permiso; si no, queda
    // deshabilitado con tooltip explicativo (ver CLAUDE.md §26).
    if (this.#hasPerm('Configurations_Connections_Create')) {
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
      placeholder: 'No hay conexiones registradas',
      columnDefaults: { headerSort: false },

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

    // Columna Acciones siempre presente; el botón editar se deshabilita con
    // tooltip cuando falta el permiso (ver CLAUDE.md §26).
    columns.push({
      title: 'Acciones', field: 'Id', width: 100, hozAlign: 'center', headerSort: false,
      formatter: (cell) => this.#editButton(cell.getValue(), canEdit),
      cellClick: (e, cell) => {
        if (e.target.closest('[data-action-type="edit"]')) {
          this.#onEditClick(cell.getRow().getData());
        }
      },
    });

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
      this.#totalRecords = total;
      const lastPage = Math.max(1, Math.ceil(total / size));
      return { data: json.Data, last_page: lastPage };
    } catch (err) {
      showToast(err.message || 'Error al obtener las conexiones', 'error');
      return { data: [], last_page: 1 };
    }
  }

  // ── Acciones públicas — lista ────────────────────────────────────────────────

  search() {
    this.table.setData();   // recarga vía ajax y vuelve a la página 1
  }

  // ── Panel lateral — crear / editar ───────────────────────────────────────────

  /** Abre el panel en modo creación. */
  openCreatePanel() {
    if (!this.#hasPerm('Configurations_Connections_Create')) {
      showToast('No cuenta con permisos para realizar esta acción.', 'info');
      return;
    }

    this.#editMode     = false;
    this.#connectionId = 0;

    this.#resetPanel();
    this.panelTitleTarget.textContent  = 'Nueva Conexión SAP';
    this.submitIconTarget.textContent  = 'check';
    this.submitLabelTarget.textContent = 'Crear conexión';

    this.#openPanel();
  }

  /** Abre el panel en modo edición y carga los datos de la conexión. */
  async #onEditClick(conn) {
    if (!this.#hasPerm('Configurations_Connections_Update')) {
      showToast('No cuenta con permisos para realizar esta acción.', 'info');
      return;
    }

    this.#editMode     = true;
    this.#connectionId = conn.Id;

    this.#resetPanel();
    this.panelTitleTarget.textContent  = 'Editar Conexión SAP';
    this.submitIconTarget.textContent  = 'autorenew';
    this.submitLabelTarget.textContent = 'Actualizar';

    this.#openPanel();

    // Cargar la conexión completa (la fila de la tabla no trae DBPass ni todos los campos)
    try {
      const { json } = await this.#apiFetch(`/api/Connections/${this.#connectionId}`);
      if (!json.Data) {
        showToast(json.Message || 'No se encontró la conexión', 'error');
        this.closePanel();
        return;
      }
      this.#fillPanel(json.Data);
    } catch (err) {
      showToast(err.message || 'Error al cargar la conexión', 'error');
      this.closePanel();
    }
  }

  closePanel() {
    this.panelTarget.classList.add('translate-x-full');
    this.panelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  togglePassword() {
    this.#passVisible = !this.#passVisible;
    this.fDbPassTarget.type               = this.#passVisible ? 'text' : 'password';
    this.togglePassIconTarget.textContent = this.#passVisible ? 'visibility' : 'visibility_off';
  }

  /** Muestra la descripción del tipo de servidor y ajusta si usuario/contraseña son requeridos. */
  serverTypeChanged() {
    this.#updateServerTypeHint();
    this.#updateCredentialRequirement();
  }

  /**
   * Usuario y contraseña de base de datos solo son obligatorios cuando el tipo
   * de servidor es HANASERVER. Refleja la condición en los asteriscos del label.
   * La contraseña nunca se marca requerida en edición: el API no la devuelve por
   * seguridad y, si se deja en blanco, el backend conserva la contraseña actual.
   */
  #updateCredentialRequirement() {
    const required = this.fServerTypeTarget.value === 'HANASERVER';
    this.fDbUserRequiredTarget.classList.toggle('hidden', !required);
    this.fDbPassRequiredTarget.classList.toggle('hidden', !required || this.#editMode);
    this.fDbPassHintTarget.classList.toggle('hidden', !this.#editMode);
  }

  /** Habilita el botón de guardar solo cuando todos los campos requeridos están completos. */
  refreshSubmitState() {
    this.submitBtnTarget.disabled = !this.#isFormValid();
  }

  /** ¿Están completos todos los campos obligatorios del panel? */
  #isFormValid() {
    const filled = (t) => t.value.trim() !== '';
    let ok = filled(this.fServerTarget) && filled(this.fApiUrlTarget) &&
             filled(this.fOdbcTypeTarget) && filled(this.fDbEngineTarget) &&
             filled(this.fServerTypeTarget);
    if (this.fServerTypeTarget.value === 'HANASERVER') {
      ok = ok && filled(this.fDbUserTarget) && (this.#editMode || filled(this.fDbPassTarget));
    }
    return ok;
  }

  async savePanel() {
    if (!this.#validatePanel()) return;

    const payload  = this.#buildPayload();
    const isCreate = !this.#editMode;

    this.submitBtnTarget.disabled = true;
    try {
      const { json } = await this.#apiFetch('/api/Connections', {
        method: isCreate ? 'POST' : 'PATCH',
        body:   JSON.stringify(payload),
      });

      if (!json.Data) {
        const action = isCreate ? 'crear' : 'actualizar';
        showAlert({ type: ALERT_TYPES.ERROR, title: `Error al ${action} conexión`, message: json.Message || 'Error desconocido' });
        return;
      }

      showToast(isCreate ? 'Conexión creada con éxito' : 'Conexión actualizada con éxito', 'success');
      this.closePanel();
      this.table.setData();   // refresca la lista sin recargar la página
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: err.message });
    } finally {
      this.submitBtnTarget.disabled = false;
    }
  }

  // ── Panel — helpers ──────────────────────────────────────────────────────────

  #openPanel() {
    this.panelBackdropTarget.classList.remove('hidden');
    this.panelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  #resetPanel() {
    this.#passVisible = false;
    this.fServerTarget.value        = '';
    this.fLicenseServerTarget.value = '';
    this.fApiUrlTarget.value        = '';
    this.fCrystalApiUrlTarget.value = '';
    this.fOdbcTypeTarget.value      = '';
    this.fDbEngineTarget.value      = '';
    this.fServerTypeTarget.value    = '';
    this.fDbUserTarget.value        = '';
    this.fDbPassTarget.value        = '';
    this.fDbPassTarget.type         = 'password';
    this.togglePassIconTarget.textContent = 'visibility_off';
    this.fBoSuppLangsTarget.value   = '';
    this.fDstTarget.value           = '';
    this.fUseTrustedTarget.checked  = false;
    this.#updateServerTypeHint();
    this.#updateCredentialRequirement();
    this.refreshSubmitState();

    [this.fServerErrorTarget, this.fApiUrlErrorTarget, this.fDbEngineErrorTarget,
     this.fDbUserErrorTarget, this.fDbPassErrorTarget].forEach(e => e.classList.add('hidden'));
  }

  #fillPanel(conn) {
    this.fServerTarget.value        = conn.Server        ?? '';
    this.fLicenseServerTarget.value = conn.LicenseServer ?? '';
    this.fApiUrlTarget.value        = conn.APIUrl        ?? '';
    this.fCrystalApiUrlTarget.value = conn.CrystalAPIUrl ?? '';
    this.fOdbcTypeTarget.value      = conn.ODBCType      ?? '';
    this.#applySelectValue(this.fDbEngineTarget,   conn.DBEngine   ?? '');
    this.#applySelectValue(this.fServerTypeTarget, conn.ServerType ?? '');
    this.fDbUserTarget.value        = conn.DBUser        ?? '';
    this.fDbPassTarget.value        = conn.DBPass        ?? '';
    this.fBoSuppLangsTarget.value   = conn.BoSuppLangs   ?? '';
    this.fDstTarget.value           = conn.DST           ?? '';
    this.fUseTrustedTarget.checked  = conn.UseTrusted    ?? false;
    this.#updateServerTypeHint();
    this.#updateCredentialRequirement();
    this.refreshSubmitState();
  }

  /**
   * Asigna un valor a un <select>; si el valor no corresponde a ninguna opción
   * (p. ej. una conexión legacy con un motor/tipo fuera del catálogo actual),
   * agrega una opción temporal para no perder el dato al editar.
   */
  #applySelectValue(select, value) {
    if (value && ![...select.options].some(o => o.value === value)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    }
    select.value = value;
  }

  /** Refresca el texto de ayuda bajo el select "Tipo de Servidor". */
  #updateServerTypeHint() {
    if (!this.hasFServerTypeHintTarget) return;
    this.fServerTypeHintTarget.textContent = this.#serverTypeHints[this.fServerTypeTarget.value] ?? '';
  }

  #validatePanel() {
    let valid = true;

    const required = [
      { target: this.fServerTarget,     error: this.fServerErrorTarget     },
      { target: this.fApiUrlTarget,     error: this.fApiUrlErrorTarget     },
      { target: this.fOdbcTypeTarget,   error: this.fOdbcTypeErrorTarget   },
      { target: this.fDbEngineTarget,   error: this.fDbEngineErrorTarget   },
      { target: this.fServerTypeTarget, error: this.fServerTypeErrorTarget },
    ];

    // Usuario y contraseña solo son obligatorios para servidores HANASERVER.
    // La contraseña se exime en edición: en blanco significa "no cambiar".
    if (this.fServerTypeTarget.value === 'HANASERVER') {
      required.push({ target: this.fDbUserTarget, error: this.fDbUserErrorTarget });
      if (!this.#editMode) {
        required.push({ target: this.fDbPassTarget, error: this.fDbPassErrorTarget });
      }
    }

    for (const { target, error } of required) {
      const empty = !target.value.trim();
      error.classList.toggle('hidden', !empty);
      if (empty) valid = false;
    }

    if (!valid) showToast('Por favor complete todos los campos requeridos', 'warning');
    return valid;
  }

  #buildPayload() {
    return {
      Id:            this.#editMode ? this.#connectionId : 0,
      Server:        this.fServerTarget.value.trim(),
      LicenseServer: this.fLicenseServerTarget.value.trim(),
      APIUrl:        this.fApiUrlTarget.value.trim(),
      CrystalAPIUrl: this.fCrystalApiUrlTarget.value.trim(),
      ODBCType:      this.fOdbcTypeTarget.value.trim(),
      DBEngine:      this.fDbEngineTarget.value.trim(),
      ServerType:    this.fServerTypeTarget.value.trim(),
      DBUser:        this.fDbUserTarget.value.trim(),
      DBPass:        this.fDbPassTarget.value,
      BoSuppLangs:   this.fBoSuppLangsTarget.value.trim(),
      DST:           this.fDstTarget.value.trim(),
      UseTrusted:    this.fUseTrustedTarget.checked,
    };
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  // Botón editar: habilitado (azul) o deshabilitado (gris + tooltip envuelto en
  // <span>, porque un <button disabled> no emite eventos de mouse). Ver §26.
  #editButton(id, canEdit) {
    if (canEdit) {
      return `
        <button type="button" data-action-type="edit" data-testid="btn-edit-${id}" data-tooltip="Editar"
                class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
          <span class="material-icons text-base">edit</span>
        </button>`;
    }
    return `
      <span data-tooltip="No cuenta con permisos para editar conexiones">
        <button type="button" data-testid="btn-edit-${id}" disabled
                class="p-1.5 text-gray-300 rounded cursor-not-allowed pointer-events-none">
          <span class="material-icons text-base">edit</span>
        </button>
      </span>`;
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  #hasPerm(name) {
    return this.#permissions.includes(name);
  }

  // Habilita el botón "Nueva Conexión" (nace deshabilitado/gris con tooltip de
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

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return { json, headers: response.headers };
  }
}
