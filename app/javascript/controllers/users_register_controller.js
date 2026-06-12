/**
 * UsersRegisterController — Registrar nuevo usuario.
 *
 * Migración de /configurations/users/register (Angular RegisterUsersComponent).
 *
 * Funcionalidad:
 *   - Carga inicial: GET /api/Companies/GetCompaniesByUserGroup + GET /api/Group/GetGroupsByUser
 *   - Campo Tipo OC visible solo para compañías con OC (CompanyWhitOC: 186, 1206)
 *   - Validación del formulario antes de enviar
 *   - POST /api/User → navega a /configurations/users al éxito
 */

import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';

// Compañías que requieren campo Tipo de OC
const COMPANIES_WITH_OC = new Set([186, 1206]);

export default class extends Controller {
  static targets = [
    'companySelect', 'groupSelect',
    'fullName', 'fullNameError',
    'identification', 'identificationError',
    'email', 'emailError',
    'ocTypeWrapper', 'ocType', 'ocTypeError',
    'submitBtn',
    'loadingOverlay',
  ];

  #companyId = null;

  connect() {
    const company = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    this.#loadInitialData();
    this.#setupFormValidation();
  }

  async #loadInitialData() {
    this.loadingOverlayTarget.classList.remove('hidden');
    try {
      const [companiesRes, groupsRes] = await Promise.all([
        this.#apiFetch(`/api/Companies/GetCompaniesByUserGroup?companyId=${this.#companyId}`),
        this.#apiFetch(`/api/Group/GetGroupsByUser?companyId=${this.#companyId}`),
      ]);

      const companies = companiesRes.Data || [];
      const groups    = groupsRes.Data || [];

      // Poblar select Compañía
      this.companySelectTarget.innerHTML = '';
      companies.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.Id;
        opt.textContent = c.EmsrNombre;
        this.companySelectTarget.appendChild(opt);
      });

      // Poblar select Grupo
      this.groupSelectTarget.innerHTML = '';
      groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.Id;
        opt.textContent = g.GroupName;
        this.groupSelectTarget.appendChild(opt);
      });

      // Evaluar si mostrar campo Tipo OC para la primera compañía
      if (companies.length) {
        this.#toggleOCType(parseInt(companies[0].Id));
      }
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al cargar datos', message: err.message });
    } finally {
      this.loadingOverlayTarget.classList.add('hidden');
    }
  }

  onCompanyChange() {
    const companyId = parseInt(this.companySelectTarget.value);
    this.#toggleOCType(companyId);
    this.#validateForm();
  }

  #toggleOCType(companyId) {
    const show = COMPANIES_WITH_OC.has(companyId);
    this.ocTypeWrapperTarget.classList.toggle('hidden', !show);
    if (!show) {
      this.ocTypeTarget.value = '';
      this.ocTypeErrorTarget.classList.add('hidden');
    }
  }

  #setupFormValidation() {
    const fields = [
      this.fullNameTarget,
      this.identificationTarget,
      this.emailTarget,
      this.ocTypeTarget,
    ];
    fields.forEach(f => f.addEventListener('input', () => this.#validateForm()));
  }

  #validateForm() {
    const isOCVisible = !this.ocTypeWrapperTarget.classList.contains('hidden');
    const emailRegex  = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

    const valid =
      this.fullNameTarget.value.trim() &&
      this.identificationTarget.value.trim() &&
      emailRegex.test(this.emailTarget.value.trim()) &&
      this.companySelectTarget.value &&
      this.groupSelectTarget.value &&
      (!isOCVisible || this.ocTypeTarget.value);

    this.submitBtnTarget.disabled = !valid;
  }

  async createUser() {
    if (!this.#runValidation()) return;

    this.loadingOverlayTarget.classList.remove('hidden');
    this.submitBtnTarget.disabled = true;

    const isOCVisible = !this.ocTypeWrapperTarget.classList.contains('hidden');
    const payload = {
      Id:                '',
      CompanyIdDB:       parseInt(this.companySelectTarget.value),
      GroupIdDB:         parseInt(this.groupSelectTarget.value),
      FullName:          this.fullNameTarget.value.trim(),
      Identification:    this.identificationTarget.value.trim(),
      UserName:          this.emailTarget.value.trim(),
      Email:             this.emailTarget.value.trim(),
      EmailConfirmed:    false,
      Owner:             false,
      CreateDate:        new Date().toISOString(),
      Active:            false,
      PasswordHash:      '',
      SapUser:           '',
      SapPass:           '',
      DocNumberPreference: isOCVisible ? (this.ocTypeTarget.value || '') : '',
    };

    try {
      await this.#apiFetch('/api/User', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Usuario registrado exitosamente', 'success');
      window.location.href = '/configurations/users';
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al registrar usuario', message: err.message });
      this.submitBtnTarget.disabled = false;
    } finally {
      this.loadingOverlayTarget.classList.add('hidden');
    }
  }

  #runValidation() {
    let valid = true;
    const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
    const isOCVisible = !this.ocTypeWrapperTarget.classList.contains('hidden');

    const check = (target, errorTarget, condition) => {
      const ok = condition();
      errorTarget.classList.toggle('hidden', ok);
      if (!ok) valid = false;
    };

    check(this.fullNameTarget,       this.fullNameErrorTarget,       () => !!this.fullNameTarget.value.trim());
    check(this.identificationTarget, this.identificationErrorTarget, () => !!this.identificationTarget.value.trim());
    check(this.emailTarget,          this.emailErrorTarget,          () => emailRegex.test(this.emailTarget.value.trim()));
    if (isOCVisible) {
      check(this.ocTypeTarget, this.ocTypeErrorTarget, () => !!this.ocTypeTarget.value);
    }

    return valid;
  }

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
