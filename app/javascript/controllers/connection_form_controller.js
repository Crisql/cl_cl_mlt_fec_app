import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';

/**
 * ConnectionFormController — Crear / Editar una conexión SAP.
 *
 * Replica: Angular CreateOrUpdateConnectionComponent
 *
 * Modos:
 *   - create: connectionIdValue = 0  → botón "Crear", DBPass requerida
 *   - edit:   connectionIdValue > 0  → botón "Actualizar", carga data vía GET
 *
 * Storage (fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session       → { access_token, ... }
 *   - sessionStorage.Permissions → string[]
 *
 * API:
 *   - GET   /api/Connections/:id   (modo edición)
 *   - POST  /api/Connections       (crear)
 *   - PATCH /api/Connections       (actualizar)
 */
export default class extends Controller {
  static values = { connectionId: Number };

  static targets = [
    'server',       'serverError',
    'licenseServer',
    'apiUrl',       'apiUrlError',
    'crystalApiUrl',
    'odbcType',     'odbcTypeError',
    'dbEngine',     'dbEngineError',
    'serverType',   'serverTypeError', 'serverTypeHint',
    'dbUser',       'dbUserError', 'dbUserRequired',
    'dbPass',       'dbPassError', 'dbPassRequired',
    'boSuppLangs',
    'dst',
    'useTrusted',
    'togglePassIcon',
    'submitBtn', 'submitIcon', 'submitLabel',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  #isEditMode   = false;
  #permissions  = [];
  #passVisible  = false;

  // Descripción por valor de "Tipo de Servidor". El sufijo "T" indica conexión de
  // confianza (Trusted / autenticación de Windows). Los valores HANA arman el
  // connectionString para SAP HANA Studio; los SQL arman el de SQL Server.
  #serverTypeHints = {
    SQLSERVERT:  'SQL Server con conexión de confianza (autenticación de Windows / Trusted).',
    HANASERVER:  'SAP HANA con autenticación estándar (usuario y contraseña).',
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    this.#onLoad();
  }

  // ── Inicialización ────────────────────────────────────────────────────────

  #onLoad() {
    const perms = SStore.get('Permissions');
    this.#permissions = Array.isArray(perms) ? perms : [];

    this.#isEditMode = this.connectionIdValue > 0;

    if (this.#isEditMode) {
      this.#initEditMode();
    } else {
      this.#initCreateMode();
    }
  }

  async #initCreateMode() {
    if (!this.#hasPerm('Configurations_Connections_Create')) {
      await showAlert({ type: ALERT_TYPES.WARNING, title: 'Acceso Denegado', message: 'No cuenta con permisos para crear conexiones.' });
      window.location.href = '/configurations/connections';
      return;
    }

    this.submitIconTarget.textContent  = 'check';
    this.submitLabelTarget.textContent = 'Crear';
    this.#updateCredentialRequirement();
    this.refreshSubmitState();
  }

  async #initEditMode() {
    if (!this.#hasPerm('Configurations_Connections_Update')) {
      await showAlert({ type: ALERT_TYPES.WARNING, title: 'Acceso Denegado', message: 'No cuenta con permisos para actualizar conexiones.' });
      window.location.href = '/configurations/connections';
      return;
    }

    this.submitIconTarget.textContent  = 'autorenew';
    this.submitLabelTarget.textContent = 'Actualizar';
    this.#updateCredentialRequirement();

    this.#loadConnection();
  }

  // ── API ───────────────────────────────────────────────────────────────────

  async #loadConnection() {
    try {
      const json = await this.#apiFetch(`/api/Connections/${this.connectionIdValue}`);

      if (!json.Data) {
        showToast(json.Message || 'No se encontró la conexión', 'error');
        setTimeout(() => window.location.href = '/configurations/connections', 2000);
        return;
      }

      this.#fillForm(json.Data);
    } catch (err) {
      showToast(err.message || 'Error al cargar la conexión', 'error');
      setTimeout(() => window.location.href = '/configurations/connections', 2000);
    }
  }

  #fillForm(conn) {
    this.serverTarget.value        = conn.Server        ?? '';
    this.licenseServerTarget.value = conn.LicenseServer ?? '';
    this.apiUrlTarget.value        = conn.APIUrl        ?? '';
    this.crystalApiUrlTarget.value = conn.CrystalAPIUrl ?? '';
    this.odbcTypeTarget.value      = conn.ODBCType      ?? '';
    this.#applySelectValue(this.dbEngineTarget,   conn.DBEngine   ?? '');
    this.#applySelectValue(this.serverTypeTarget, conn.ServerType ?? '');
    this.dbUserTarget.value        = conn.DBUser        ?? '';
    this.dbPassTarget.value        = conn.DBPass        ?? '';
    this.boSuppLangsTarget.value   = conn.BoSuppLangs   ?? '';
    this.dstTarget.value           = conn.DST           ?? '';
    this.useTrustedTarget.checked  = conn.UseTrusted    ?? false;
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
    if (!this.hasServerTypeHintTarget) return;
    this.serverTypeHintTarget.textContent = this.#serverTypeHints[this.serverTypeTarget.value] ?? '';
  }

  // ── Handlers de eventos ───────────────────────────────────────────────────

  togglePassword() {
    this.#passVisible = !this.#passVisible;
    this.dbPassTarget.type             = this.#passVisible ? 'text' : 'password';
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
   */
  #updateCredentialRequirement() {
    const required = this.serverTypeTarget.value === 'HANASERVER';
    this.dbUserRequiredTarget.classList.toggle('hidden', !required);
    this.dbPassRequiredTarget.classList.toggle('hidden', !required);
  }

  /** Habilita el botón de guardar solo cuando todos los campos requeridos están completos. */
  refreshSubmitState() {
    this.submitBtnTarget.disabled = !this.#isFormValid();
  }

  /** ¿Están completos todos los campos obligatorios del formulario? */
  #isFormValid() {
    const filled = (t) => t.value.trim() !== '';
    let ok = filled(this.serverTarget) && filled(this.apiUrlTarget) &&
             filled(this.odbcTypeTarget) && filled(this.dbEngineTarget) &&
             filled(this.serverTypeTarget);
    if (this.serverTypeTarget.value === 'HANASERVER') {
      ok = ok && filled(this.dbUserTarget) && filled(this.dbPassTarget);
    }
    return ok;
  }

  async save() {
    if (!this.#validate()) return;

    const payload = this.#buildPayload();
    const isCreate = !this.#isEditMode;

    try {
      const json = await this.#apiFetch('/api/Connections', {
        method: isCreate ? 'POST' : 'PATCH',
        body:   JSON.stringify(payload),
      });

      if (!json.Data) {
        const action = isCreate ? 'crear' : 'actualizar';
        showAlert({ type: ALERT_TYPES.ERROR, title: `Error al ${action} conexión`, message: json.Message || 'Error desconocido' });
        return;
      }

      const msg = isCreate ? 'Conexión creada con éxito' : 'Conexión actualizada con éxito';
      showToast(msg, 'success');

      setTimeout(() => { window.location.href = '/configurations/connections'; }, 1500);
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: err.message });
    }
  }

  cancel() {
    window.location.href = '/configurations/connections';
  }

  // ── Validación ────────────────────────────────────────────────────────────

  #validate() {
    let valid = true;

    const required = [
      { target: this.serverTarget,     error: this.serverErrorTarget     },
      { target: this.apiUrlTarget,     error: this.apiUrlErrorTarget     },
      { target: this.odbcTypeTarget,   error: this.odbcTypeErrorTarget   },
      { target: this.dbEngineTarget,   error: this.dbEngineErrorTarget   },
      { target: this.serverTypeTarget, error: this.serverTypeErrorTarget },
    ];

    // Usuario y contraseña solo son obligatorios para servidores HANASERVER.
    if (this.serverTypeTarget.value === 'HANASERVER') {
      required.push({ target: this.dbUserTarget, error: this.dbUserErrorTarget });
      required.push({ target: this.dbPassTarget, error: this.dbPassErrorTarget });
    }

    for (const { target, error } of required) {
      const empty = !target.value.trim();
      error.classList.toggle('hidden', !empty);
      if (empty) valid = false;
    }

    if (!valid) {
      showToast('Por favor complete todos los campos requeridos', 'warning');
    }

    return valid;
  }

  #buildPayload() {
    return {
      Id:            this.#isEditMode ? this.connectionIdValue : 0,
      Server:        this.serverTarget.value.trim(),
      LicenseServer: this.licenseServerTarget.value.trim(),
      APIUrl:        this.apiUrlTarget.value.trim(),
      CrystalAPIUrl: this.crystalApiUrlTarget.value.trim(),
      ODBCType:      this.odbcTypeTarget.value.trim(),
      DBEngine:      this.dbEngineTarget.value.trim(),
      ServerType:    this.serverTypeTarget.value.trim(),
      DBUser:        this.dbUserTarget.value.trim(),
      DBPass:        this.dbPassTarget.value,
      BoSuppLangs:   this.boSuppLangsTarget.value.trim(),
      DST:           this.dstTarget.value.trim(),
      UseTrusted:    this.useTrustedTarget.checked,
    };
  }

  // ── Helpers generales ─────────────────────────────────────────────────────

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

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.json();
  }
}
