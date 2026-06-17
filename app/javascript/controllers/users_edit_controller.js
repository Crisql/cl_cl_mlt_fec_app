/**
 * UsersEditController — Editar usuario existente.
 *
 * Migración de /configurations/users/update?userId=... (Angular EditUserComponent).
 *
 * Funcionalidad:
 *   - Lee userId del query string
 *   - Carga datos del usuario: GET /api/User/information?userId=...
 *   - Carga compañías asignadas: GET /api/User/companies?userId=...
 *   - Toggle visibilidad contraseña SAP
 *   - Probar credenciales SAP: POST /api/SapConnections/validate-credentials
 *     (solo habilitado cuando se edita SapUser o SapPass + se selecciona compañía)
 *   - PATCH /api/User → navega a /configurations/users al éxito
 */

import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';

export default class extends Controller {
  static targets = [
    'fullName', 'fullNameError',
    'identification', 'identificationError',
    'sapUser', 'sapUserError',
    'sapPass', 'passIcon',
    'credentialCompany',
    'activeCheck',
    'testCredBtn', 'testCredIcon', 'testCredLabel',
    'submitBtn',
    'loadingOverlay',
  ];

  #userId             = null;
  #userInfo           = null;
  #companyId          = null;
  #credentialsDirty   = false;
  #credentialsValidated = false;

  connect() {
    const params = new URLSearchParams(window.location.search);
    this.#userId = params.get('userId');
    const company = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    if (!this.#userId) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: 'No se proporcionó el ID del usuario.' });
      Turbo.visit('/configurations/users');
      return;
    }

    this.#loadUserData();
  }

  async #loadUserData() {
    this.loadingOverlayTarget.classList.remove('hidden');
    try {
      const [userRes, companiesRes] = await Promise.all([
        this.#apiFetch(`/api/User/information?userId=${encodeURIComponent(this.#userId)}`),
        this.#apiFetch(`/api/User/companies?userId=${encodeURIComponent(this.#userId)}`),
      ]);

      if (!userRes.Data) {
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Error', message: 'No se encontró el usuario.' });
        Turbo.visit('/configurations/users');
        return;
      }

      this.#userInfo = userRes.Data;
      this.#fillForm(userRes.Data);
      this.#populateCompanies(companiesRes.Data || []);
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al cargar el usuario', message: err.message });
      Turbo.visit('/configurations/users');
    } finally {
      this.loadingOverlayTarget.classList.add('hidden');
    }
  }

  #fillForm(user) {
    this.fullNameTarget.value       = user.FullName       || '';
    this.identificationTarget.value = user.Identification || '';
    this.sapUserTarget.value        = user.SapUser        || '';
    this.sapPassTarget.value        = '';
    this.activeCheckTarget.checked  = !!user.Active;
    this.#credentialsDirty     = false;
    this.#credentialsValidated = false;
    this.#updateTestCredBtn();
  }

  #populateCompanies(companies) {
    this.credentialCompanyTarget.innerHTML = '<option value="">-- Seleccione --</option>';
    companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.Id;
      opt.textContent = c.EmsrNombreComercial || c.EmsrNombre;
      this.credentialCompanyTarget.appendChild(opt);
    });
  }

  // ── Toggle contraseña ────────────────────────────────────────────────────────

  togglePassVisibility() {
    const isPassword = this.sapPassTarget.type === 'password';
    this.sapPassTarget.type = isPassword ? 'text' : 'password';
    this.passIconTarget.textContent = isPassword ? 'visibility' : 'visibility_off';
  }

  // ── Cambios en campos SAP ─────────────────────────────────────────────────────

  onSapFieldChange() {
    this.#credentialsDirty     = true;
    this.#credentialsValidated = false;
    this.#updateTestCredBtn();
    this.#updateSubmitBtn();
  }

  onCredentialCompanyChange() {
    this.#credentialsValidated = false;
    this.#updateTestCredBtn();
    this.#updateSubmitBtn();
  }

  #updateTestCredBtn() {
    const canTest = this.#credentialsDirty && !!this.credentialCompanyTarget.value;
    this.testCredBtnTarget.disabled = !canTest;

    if (this.#credentialsValidated) {
      this.testCredIconTarget.textContent  = 'check_circle';
      this.testCredLabelTarget.textContent = 'Credenciales verificadas';
      this.testCredBtnTarget.classList.add('text-green-600', 'border-green-400');
      this.testCredBtnTarget.classList.remove('text-gray-700', 'border-gray-300');
    } else {
      this.testCredIconTarget.textContent  = 'wifi_tethering';
      this.testCredLabelTarget.textContent = 'Probar credenciales';
      this.testCredBtnTarget.classList.remove('text-green-600', 'border-green-400');
      this.testCredBtnTarget.classList.add('text-gray-700', 'border-gray-300');
    }
  }

  #updateSubmitBtn() {
    // Si las credenciales se editaron y no se han validado, bloquear guardar
    const blocked = this.#credentialsDirty && !this.#credentialsValidated;
    this.submitBtnTarget.disabled = blocked;
  }

  // ── Probar credenciales ───────────────────────────────────────────────────────

  async testCredentials() {
    const sapUser = this.sapUserTarget.value.trim();
    const sapPass = this.sapPassTarget.value;
    const companyId = parseInt(this.credentialCompanyTarget.value);

    if (!sapUser || !sapPass) {
      showToast('Complete el Usuario y Contraseña de SAP antes de probar.', 'warning');
      return;
    }
    if (!companyId) {
      showToast('Seleccione una compañía para probar las credenciales.', 'warning');
      return;
    }

    this.testCredBtnTarget.disabled = true;
    this.testCredIconTarget.textContent  = 'hourglass_empty';
    this.testCredLabelTarget.textContent = 'Probando...';

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
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al validar credenciales', message: err.message });
    } finally {
      this.#updateTestCredBtn();
      this.#updateSubmitBtn();
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────────

  async updateUser() {
    if (!this.#runValidation()) return;

    this.loadingOverlayTarget.classList.remove('hidden');
    this.submitBtnTarget.disabled = true;

    const payload = {
      ...this.#userInfo,
      Id:             this.#userId,
      FullName:       this.fullNameTarget.value.trim(),
      Identification: this.identificationTarget.value.trim(),
      SapUser:        this.sapUserTarget.value.trim(),
      SapPass:        this.sapPassTarget.value || '',
      Active:         this.activeCheckTarget.checked,
    };

    try {
      await this.#apiFetch('/api/User', { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Usuario actualizado con éxito', 'success');
      Turbo.visit('/configurations/users');
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar usuario', message: err.message });
      this.submitBtnTarget.disabled = false;
    } finally {
      this.loadingOverlayTarget.classList.add('hidden');
    }
  }

  #runValidation() {
    let valid = true;

    const check = (target, errorTarget, condition) => {
      const ok = condition();
      errorTarget.classList.toggle('hidden', ok);
      if (!ok) valid = false;
    };

    check(this.fullNameTarget,       this.fullNameErrorTarget,       () => !!this.fullNameTarget.value.trim());
    check(this.identificationTarget, this.identificationErrorTarget, () => !!this.identificationTarget.value.trim());
    check(this.sapUserTarget,        this.sapUserErrorTarget,        () => !!this.sapUserTarget.value.trim());

    return valid;
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
