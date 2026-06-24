import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';

// Compañías con campo OCTypeControl habilitado (CompanyWhitOC enum del legacy Angular)
const COMPANIES_WITH_OC = [186, 1206];

/**
 * UserProfileController — Actualización de información de perfil del usuario.
 *
 * Replica la funcionalidad del componente Angular UpdateUserInfoComponent:
 * - Carga inicial: GetUserInfo + GetGroupsByUser + GetCompanies (paralelo)
 * - Toggle visibilidad de contraseña
 * - credentialsDirty tracking (SapUser / SapPass changes)
 * - Botón "Probar credenciales" con 3 estados (default / validating / verified)
 * - OCTypeControl condicional según compañía seleccionada
 * - PATCH api/User/profile-info con payload completo del usuario
 */
export default class extends Controller {
  static targets = [
    'form',
    'sapUserInput',
    'sapUserError',
    'sapPassInput',
    'togglePasswordBtn',
    'eyeIcon',
    'companySelect',
    'ocTypeSection',
    'ocTypeSelect',
    'btnTestCredentials',
    'testCredentialsIcon',
    'testCredentialsLabel',
    'btnUpdate',
    'cardLoader',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  /** Datos completos del usuario recibidos de la API */
  #userInfo = null;

  /** true si SapUser o SapPass fueron modificados desde la última carga/actualización */
  #credentialsDirty = false;

  /** true si las credenciales fueron validadas exitosamente */
  #credentialsValidated = false;

  /** Indica si la validación de credenciales está en curso */
  #isValidating = false;

  /** ID de compañía actualmente seleccionado en el storage */
  #selectedCompanyFromStorage = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    this.#onLoad();
  }

  // ── Inicialización ────────────────────────────────────────────────────────

  async #onLoad() {
    this.#showCardLoader();
    this.#resetCredentialState();
    this.#readSelectedCompanyFromStorage();
    try {
      await Promise.all([
        this.#loadInitialData(),
        this.#loadAssignableCompanies(),
      ]);
    } finally {
      this.#hideCardLoader();
    }
  }

  #showCardLoader() {
    this.cardLoaderTarget?.classList.remove('hidden');
  }

  #hideCardLoader() {
    this.cardLoaderTarget?.classList.add('hidden');
  }

  #readSelectedCompanyFromStorage() {
    const company = SStore.get('CurrentCompany');
    this.#selectedCompanyFromStorage = company?.companyId ?? null;
  }

  async #loadInitialData() {
    try {
      const companyId = this.#selectedCompanyFromStorage;

      const [userInfoRes, groupsRes] = await Promise.all([
        this.#get('api/User/GetUserInfo'),
        this.#get(`api/Group/GetGroupsByUser?companyId=${companyId}`),
      ]);

      this.#userInfo = userInfoRes.Data?.[0] ?? null;

      if (this.#userInfo) {
        this.#fillForm(this.#userInfo.SapUser);
        this.#configureOcTypeVisibility(companyId);
        this.#setOcTypeValue(this.#userInfo.DocNumberPreference);
      }

      // groupsRes.Data disponible para uso futuro
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Se produjo un error al obtener la información', message: this.#extractError(err) });
    }
  }

  async #loadAssignableCompanies() {
    try {
      const data = await this.#get(
        'api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active'
      );
      const companies = data.Data ?? [];

      // Limpiar opciones previas (excepto placeholder)
      while (this.companySelectTarget.options.length > 1) {
        this.companySelectTarget.remove(1);
      }

      companies.forEach(c => {
        const option = document.createElement('option');
        option.value = c.Id;
        option.textContent = c.EmsrNombreComercial || c.EmsrNombre;
        this.companySelectTarget.appendChild(option);
      });

      // Pre-seleccionar compañía del storage
      if (this.#selectedCompanyFromStorage) {
        this.companySelectTarget.value = String(this.#selectedCompanyFromStorage);
      }
    } catch {
      // Error silencioso — el usuario puede seleccionar manualmente
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  #fillForm(sapUser) {
    this.sapUserInputTarget.value = sapUser ?? '';
    this.sapPassInputTarget.value = '';
  }

  #configureOcTypeVisibility(companyId) {
    const id = Number(companyId);
    const isOcCompany = COMPANIES_WITH_OC.includes(id);

    if (isOcCompany) {
      this.ocTypeSectionTarget.classList.remove('hidden');
    } else {
      this.ocTypeSectionTarget.classList.add('hidden');
    }
  }

  #setOcTypeValue(preference) {
    if (!preference) return;
    const val = String(preference);
    const exists = Array.from(this.ocTypeSelectTarget.options).some(o => o.value === val);
    if (exists) {
      this.ocTypeSelectTarget.value = val;
    }
  }

  #resetCredentialState() {
    this.#credentialsDirty = false;
    this.#credentialsValidated = false;
    this.#isValidating = false;
    this.#syncButtonStates();
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  /**
   * Disparado por cambios en SapUser o SapPass.
   * Activa credentialsDirty y habilita el select de compañías.
   */
  onCredentialChange() {
    this.#credentialsDirty = true;
    this.#credentialsValidated = false;
    this.companySelectTarget.disabled = false;
    this.#setTip(
      this.companySelectTarget,
      'Seleccione la compañía con la que desea probar las credenciales'
    );
    this.#syncButtonStates();
  }

  /**
   * Disparado por cambio en el select de compañías.
   * Resetea credentialsValidated (hay que revalidar con la nueva compañía).
   */
  onCompanyChange() {
    if (this.#credentialsDirty) {
      this.#credentialsValidated = false;
      this.#syncButtonStates();
    }
  }

  /** Toggle visibilidad contraseña SAP */
  togglePasswordVisibility() {
    const input = this.sapPassInputTarget;
    const icon  = this.eyeIconTarget;

    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = 'visibility';
    } else {
      input.type = 'password';
      icon.textContent = 'visibility_off';
    }
  }

  /** Click en "Probar credenciales" */
  async testCredentials() {
    const selectedCompanyId = Number(this.companySelectTarget.value);
    const sapUser = this.sapUserInputTarget.value.trim();
    const sapPass = this.sapPassInputTarget.value;

    if (!selectedCompanyId) {
      showToast('Seleccione una compañía para probar las credenciales.', 'warning');
      return;
    }

    if (!sapUser || !sapPass) {
      showToast('Complete el Usuario y Contraseña de SAP antes de probar.', 'warning');
      return;
    }

    this.#isValidating = true;
    this.#credentialsValidated = false;
    this.#syncButtonStates();

    try {
      const data = await this.#post('api/Connections/validate-user-credentials', {
        SapUser: sapUser,
        SapPass: sapPass,
        CompanyId: selectedCompanyId,
      });

      if (data?.Data === true) {
        this.#credentialsValidated = true;
      } else {
        this.#credentialsValidated = false;
        const message = data?.Message || 'No se pudo conectar a SAP Service Layer.';
        showAlert({ type: ALERT_TYPES.ERROR, title: 'Credenciales inválidas', message });
      }
    } catch (err) {
      this.#credentialsValidated = false;
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al validar credenciales', message: this.#extractError(err) });
    } finally {
      this.#isValidating = false;
      this.#syncButtonStates();
    }
  }

  /** Submit del formulario — equivale a OnSubmitUpdateUserInfo */
  async onSubmit(event) {
    event.preventDefault();

    if (!this.#validateForm()) return;
    if (this.#updateIsBlocked()) return;

    const sapUser = this.sapUserInputTarget.value.trim();
    const sapPass = this.sapPassInputTarget.value;
    const ocTypeValue = this.#isOcTypeVisible()
      ? this.ocTypeSelectTarget.value
      : (this.#userInfo?.DocNumberPreference ?? '');

    const payload = {
      ...this.#userInfo,
      SapUser: sapUser,
      SapPass: sapPass,
      DocNumberPreference: String(ocTypeValue),
    };

    this.btnUpdateTarget.disabled = true;

    try {
      await this.#patch('api/User/profile-info', payload);
      showToast('Información actualizada con éxito!!!', 'success');
      this.#onLoad();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: 'Error al actualizar perfil', message: this.#extractError(err) });
    } finally {
      this.btnUpdateTarget.disabled = false;
    }
  }

  // ── Estado de botones ─────────────────────────────────────────────────────

  #syncButtonStates() {
    this.#syncCompanySelectTip();
    this.#syncTestCredentialsBtn();
    this.#syncUpdateBtn();
  }

  #syncCompanySelectTip() {
    const tip = this.companySelectTarget.disabled
      ? 'Modifique el usuario o la contraseña de SAP para habilitar la selección de compañía'
      : 'Seleccione la compañía con la que desea probar las credenciales';
    this.#setTip(this.companySelectTarget, tip);
  }

  #syncTestCredentialsBtn() {
    const btn   = this.btnTestCredentialsTarget;
    const icon  = this.testCredentialsIconTarget;
    const label = this.testCredentialsLabelTarget;

    const companySelected = !!this.companySelectTarget.value;
    const canTest = this.#credentialsDirty && companySelected && !this.#isValidating;

    btn.disabled = !canTest;

    if (this.#isValidating) {
      icon.textContent  = 'hourglass_empty';
      label.textContent = 'Probando...';
      btn.classList.remove('btn-verified');
      this.#setTip(btn, 'Validando las credenciales de SAP, espere por favor');
    } else if (this.#credentialsValidated) {
      icon.textContent  = 'check_circle';
      label.textContent = 'Credenciales verificadas';
      btn.classList.add('btn-verified');
      this.#setTip(btn, 'Las credenciales de SAP ya fueron verificadas correctamente');
    } else {
      icon.textContent  = 'wifi_tethering';
      label.textContent = 'Probar credenciales';
      btn.classList.remove('btn-verified');
      // Tooltip accionable según la condición que mantiene el botón deshabilitado
      if (!this.#credentialsDirty) {
        this.#setTip(btn, 'Modifique el usuario o la contraseña de SAP para probar las credenciales');
      } else if (!companySelected) {
        this.#setTip(btn, 'Seleccione una compañía para probar las credenciales');
      } else {
        this.#setTip(btn, 'Probar las credenciales de SAP en la compañía seleccionada');
      }
    }
  }

  #syncUpdateBtn() {
    const formInvalid = !this.sapUserInputTarget.value.trim();
    const blocked     = this.#updateIsBlocked();
    this.btnUpdateTarget.disabled = formInvalid || blocked;

    // Tooltip accionable según la condición que mantiene el botón deshabilitado
    if (formInvalid) {
      this.#setTip(this.btnUpdateTarget, 'Ingrese el usuario de SAP para guardar los cambios');
    } else if (blocked) {
      this.#setTip(this.btnUpdateTarget, 'Pruebe las credenciales de SAP antes de guardar los cambios');
    } else {
      this.#setTip(this.btnUpdateTarget, 'Guardar los cambios del perfil');
    }
  }

  /**
   * Mantiene sincronizados los dos atributos de tooltip de un control:
   * `data-tooltip` (convención §2) y `title` (fallback nativo del navegador).
   * Todo botón/control deshabilitado debe describir la condición para habilitarlo.
   */
  #setTip(el, text) {
    if (!el) return;
    el.dataset.tooltip = text;
    el.setAttribute('title', text);
  }

  #updateIsBlocked() {
    return this.#credentialsDirty && !this.#credentialsValidated;
  }

  #isOcTypeVisible() {
    return !this.ocTypeSectionTarget.classList.contains('hidden');
  }

  // ── Validación de formulario ──────────────────────────────────────────────

  #validateForm() {
    const sapUser = this.sapUserInputTarget.value.trim();
    if (!sapUser) {
      this.sapUserErrorTarget.classList.remove('hidden');
      this.sapUserInputTarget.focus();
      return false;
    }
    this.sapUserErrorTarget.classList.add('hidden');
    return true;
  }

  // ── API helpers ───────────────────────────────────────────────────────────

  async #get(path) {
    return this.#apiFetch(`/${path}`);
  }

  async #post(path, body) {
    return this.#apiFetch(`/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async #patch(path, body) {
    return this.#apiFetch(`/${path}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {};
    const token   = session.access_token;

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const contentLength = res.headers.get('content-length');
    if (contentLength === '0' || !contentType.includes('json')) return {};
    return res.json();
  }

  #extractError(err) {
    if (typeof err === 'string') return err;
    return err?.message ?? 'Ocurrió un error inesperado.';
  }
}
