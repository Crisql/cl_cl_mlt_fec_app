import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast } from 'vendor/clavisco/alerts';

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
    'odbcType',
    'dbEngine',     'dbEngineError',
    'serverType',
    'dbUser',       'dbUserError',
    'dbPass',       'dbPassError', 'dbPassRequired',
    'boSuppLangs',
    'dst',
    'useTrusted',
    'togglePassIcon',
    'submitBtn', 'submitIcon', 'submitLabel',
    'errorModal', 'errorIcon', 'errorTitle', 'errorSubtitle',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  #isEditMode   = false;
  #permissions  = [];
  #passVisible  = false;

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

  #initCreateMode() {
    if (!this.#hasPerm('Configurations_Connections_Create')) {
      this.#showAccessDeniedAndRedirect('No cuenta con permisos para crear conexiones.');
      return;
    }

    this.submitIconTarget.textContent  = 'check';
    this.submitLabelTarget.textContent = 'Crear';
    this.dbPassRequiredTarget.classList.remove('hidden');
  }

  #initEditMode() {
    if (!this.#hasPerm('Configurations_Connections_Update')) {
      this.#showAccessDeniedAndRedirect('No cuenta con permisos para actualizar conexiones.');
      return;
    }

    this.submitIconTarget.textContent  = 'autorenew';
    this.submitLabelTarget.textContent = 'Actualizar';
    this.dbPassRequiredTarget.classList.add('hidden');

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
    this.dbEngineTarget.value      = conn.DBEngine      ?? '';
    this.serverTypeTarget.value    = conn.ServerType    ?? '';
    this.dbUserTarget.value        = conn.DBUser        ?? '';
    this.dbPassTarget.value        = conn.DBPass        ?? '';
    this.boSuppLangsTarget.value   = conn.BoSuppLangs   ?? '';
    this.dstTarget.value           = conn.DST           ?? '';
    this.useTrustedTarget.checked  = conn.UseTrusted    ?? false;
  }

  // ── Handlers de eventos ───────────────────────────────────────────────────

  togglePassword() {
    this.#passVisible = !this.#passVisible;
    this.dbPassTarget.type             = this.#passVisible ? 'text' : 'password';
    this.togglePassIconTarget.textContent = this.#passVisible ? 'visibility' : 'visibility_off';
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
        this.#showErrorModal(`Error al ${action} conexión`, json.Message || 'Error desconocido');
        return;
      }

      const msg = isCreate ? 'Conexión creada con éxito' : 'Conexión actualizada con éxito';
      showToast(msg, 'success');

      setTimeout(() => { window.location.href = '/configurations/connections'; }, 1500);
    } catch (err) {
      this.#showErrorModal('Error', err.message);
    }
  }

  cancel() {
    window.location.href = '/configurations/connections';
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
    if (this._redirectAfterClose) {
      window.location.href = this._redirectAfterClose;
    }
  }

  // ── Validación ────────────────────────────────────────────────────────────

  #validate() {
    let valid = true;

    const required = [
      { target: this.serverTarget,   error: this.serverErrorTarget   },
      { target: this.apiUrlTarget,   error: this.apiUrlErrorTarget   },
      { target: this.dbEngineTarget, error: this.dbEngineErrorTarget },
      { target: this.dbUserTarget,   error: this.dbUserErrorTarget   },
    ];

    if (!this.#isEditMode) {
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

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  #showAccessDeniedAndRedirect(message) {
    this._redirectAfterClose = '/configurations/connections';
    this.errorIconTarget.textContent    = 'warning';
    this.errorIconTarget.className      = 'material-icons text-yellow-500 text-2xl';
    this.errorTitleTarget.textContent   = 'Acceso Denegado';
    this.errorSubtitleTarget.textContent = message;
    this.errorModalTarget.classList.remove('hidden');
  }

  #redirectAfterModalClose(url) {
    this._redirectAfterClose = url;
  }

  #showErrorModal(title, subtitle) {
    this.errorIconTarget.textContent      = 'error';
    this.errorIconTarget.className        = 'material-icons text-red-500 text-2xl';
    this.errorTitleTarget.textContent     = title;
    this.errorSubtitleTarget.textContent  = subtitle;
    this.errorModalTarget.classList.remove('hidden');
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
