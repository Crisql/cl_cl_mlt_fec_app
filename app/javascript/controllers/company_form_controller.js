import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';

/**
 * CompanyFormController — Crear / Editar compañía.
 *
 * Replica: Angular CreateOrUpdateCompanyComponent
 *
 * Modos:
 *   - create: companyIdValue = 0  → botón "Registrar" visible
 *   - edit:   companyIdValue > 0  → botones "Actualizar" por sección
 *
 * Storage (ver fec-migration-docs/STORAGE-KEY-MAPPING.md):
 *   - localStorage.Session          → { access_token, expires_at, ... }
 *   - sessionStorage.CurrentCompany → { companyId, companyName, groupId, ... }
 *   - sessionStorage.Permissions    → string[]  (e.g. ["F_CreateCompany"])
 *
 * NOTA: CurrentFESession NO existe en Rails. El feToken se pasa vacío.
 * El backend lo obtiene del contexto de la empresa seleccionada.
 */
export default class extends Controller {
  static values = { companyId: Number };

  static targets = [
    // Sección 1 - Datos Generales
    'comercialName', 'comercialNameError',
    'legalName', 'legalNameError',
    'identificationType',
    'identification', 'identificationError',
    'codigoActividad', 'codigoActividadError',
    'nameToEmail',
    'groupId',
    'shortName',
    'freightCharges',
    'registrofiscal8707',
    'sapConnectionId',
    'btnAddConnection',
    'dbSap',
    'isExternal',
    'active',
    'btnSaveGeneralContainer', 'btnSaveGeneral',

    // Sección 2 - Adicional
    'additionalInformation',
    'emailCcList',
    'btnAddEmail',
    'btnSaveAdditionalContainer',

    // Sección 3 - ATV
    'certPin', 'certPinEyeIcon',
    'certPath', 'certPathText',
    'certFileInput',
    'certExpireDate',
    'tokenUsr',
    'tokenPass', 'tokenPassEyeIcon',
    'btnSaveAtvContainer',

    // Sección 4 - Adjuntos
    'logoName', 'logoFileInput',
    'printFormatName', 'printFormatFileInput',
    'btnResetFormat',
    'btnSaveAttachmentsContainer',

    // Sección 5 - Códigos de actividad
    'sectionActivityCodes',
    'activityCodesList',
    'activityCodesEmpty',
    'activityCodesDupError',
    'btnSaveActivityCodes',

    // Sección 6 - SAP / Factura Proveedor
    'useFactProv',
    'sendReceptContainer', 'sendReceptAndApInv',
    'sapFieldsGroup',
    'numSerieProv', 'numSerieFactProv',
    'defaultTaxForXml',
    'whDefault',
    'btnAddTolerance',
    'xmlToleranceList', 'xmlToleranceEmpty', 'tolerancesDupError',
    'btnAddCurrencyMapping',
    'currencyMappingList', 'currencyMappingEmpty', 'currencyMappingsDupError',
    'btnReloadSap',
    'btnSaveSap',

    // Botón registrar
    'btnRegisterContainer', 'btnRegister',

    // Modales y toast
    'errorModal', 'errorIcon', 'errorTitle', 'errorSubtitle',
    'confirmModal', 'confirmTitle', 'confirmSubtitle',
    'toast', 'toastIcon', 'toastMessage',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  #isEditing              = false;
  #selectedCertFile       = null;
  #selectedLogoFile       = null;
  #selectedPrintFormatFile = null;
  #oldCertPin             = '';
  #emailCcItems           = [];
  #xmlTolerances          = [];
  #currencyMappings       = [];
  #activityCodes          = [];
  #currenciesList         = [];
  #taxCodeList            = [];
  #warehouseList          = [];
  #companyData            = null;
  #permissions            = [];   // string[]
  #selectedCompany        = null;
  #confirmCallback        = null;

  #ideRules = {
    '01': { min: 9,  max: 9  },
    '02': { min: 10, max: 10 },
    '03': { min: 11, max: 12 },
    '04': { min: 10, max: 10 },
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    this.#onLoad();
  }

  // ── Inicialización ─────────────────────────────────────────────────────────

  #onLoad() {
    this.#isEditing       = this.companyIdValue > 0;
    this.#permissions     = SStore.get('Permissions') || [];   // string[]
    this.#selectedCompany = SStore.get('CurrentCompany') || {};

    this.#setupMode();
    this.#initEmailCc();

    if (this.#isEditing) {
      this.#loadCompanyInformation();
    } else {
      this.#loadInitialData();
    }
  }

  #setupMode() {
    if (this.#isEditing) {
      this.btnSaveGeneralContainerTarget.classList.remove('hidden');
      this.btnSaveAdditionalContainerTarget.classList.remove('hidden');
      this.btnSaveAtvContainerTarget.classList.remove('hidden');
      this.btnSaveAttachmentsContainerTarget.classList.remove('hidden');
      this.sectionActivityCodesTarget.classList.remove('hidden');
      this.btnSaveSapTarget.classList.remove('hidden');
      this.btnRegisterContainerTarget.classList.add('hidden');

      if (this.#hasPerm('F_ResetCompanyFormat')) {
        this.btnResetFormatTarget.classList.remove('hidden');
      }
      if (this.#hasPerm('Configurations_Connections_Create')) {
        this.btnAddConnectionTarget.classList.remove('hidden');
      }
    } else {
      this.btnRegisterContainerTarget.classList.remove('hidden');
      this.btnRegisterContainerTarget.classList.add('flex');
    }
  }

  #initEmailCc() {
    this.#emailCcItems = [''];
    this.#renderEmailCc();
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────

  async #loadInitialData() {
    try {
      const [groupsResp, sapResp] = await Promise.all([
        this.#apiFetch('/api/Group/GetGroups'),
        this.#apiFetch('/api/Connections/for-assignment'),
      ]);

      if (groupsResp.Data?.length) this.#fillGroupsSelect(groupsResp.Data);
      if (sapResp.Data)            this.#fillSapConnectionsSelect(sapResp.Data);

      const groupId = this.#selectedCompany?.groupId;
      if (groupId) this.groupIdTarget.value = String(groupId);

      this.#validateForm();
    } catch (err) {
      this.#showErrorModal('Se produjo un error al obtener la información', err.message);
    }
  }

  async #loadCompanyInformation() {
    const companyId = this.companyIdValue;
    try {
      const [
        groupsResp, sapResp, companyResp,
        warehouseResp, taxResp, currenciesResp,
        currencyMapResp, activityCodesResp,
      ] = await Promise.allSettled([
        this.#apiFetch('/api/Group/GetGroups'),
        this.#apiFetch('/api/Connections/for-assignment'),
        this.#apiFetch(`/api/companies/${companyId}`),
        this.#apiFetch(`/api/warehouse?companyId=${companyId}`),
        this.#apiFetch(`/api/Tax?companyId=${companyId}`),
        this.#apiFetch(`/api/Companies/${companyId}/currencies`),
        this.#apiFetch(`/api/Companies/${companyId}/currency-map`),
        this.#apiFetch(`/api/Companies/${companyId}/activity-codes`),
      ]);

      if (groupsResp.status === 'fulfilled' && groupsResp.value.Data?.length) {
        this.#fillGroupsSelect(groupsResp.value.Data);
      }
      if (sapResp.status === 'fulfilled' && sapResp.value.Data) {
        this.#fillSapConnectionsSelect(sapResp.value.Data);
      }
      if (warehouseResp.status === 'fulfilled' && warehouseResp.value?.Data?.length) {
        this.#warehouseList = warehouseResp.value.Data;
        this.#fillWarehouseSelect();
      }
      if (taxResp.status === 'fulfilled' && taxResp.value?.Data?.length) {
        this.#taxCodeList = taxResp.value.Data;
        this.#fillTaxSelect();
      }
      if (currenciesResp.status === 'fulfilled' && currenciesResp.value?.Data?.length) {
        this.#currenciesList = currenciesResp.value.Data;
      }
      if (companyResp.status === 'fulfilled' && companyResp.value.Data) {
        this.#companyData = companyResp.value.Data;
        this.#fillForms(this.#companyData);
      } else {
        const msg = companyResp.reason?.message || companyResp.value?.Message || 'Error desconocido';
        this.#showErrorModal('Se produjo un error al obtener la información de la compañía', msg);
      }
      if (currencyMapResp.status === 'fulfilled' && currencyMapResp.value?.Data?.length) {
        this.#currencyMappings = currencyMapResp.value.Data;
        this.#renderCurrencyMappings();
      }
      while (this.#activityCodes.length) this.#activityCodes.pop();
      if (activityCodesResp.status === 'fulfilled' && activityCodesResp.value?.Data?.length) {
        this.#activityCodes = activityCodesResp.value.Data;
      }
      this.#renderActivityCodes();
    } catch (err) {
      this.#showErrorModal('Se produjo un error al obtener la información', err.message);
    }
  }

  #fillForms(data) {
    this.comercialNameTarget.value      = data.EmsrNombreComercial || '';
    this.legalNameTarget.value          = data.EmsrNombre          || '';
    this.identificationTypeTarget.value = data.EmsrIdeTipo         || '01';
    this.identificationTarget.value     = data.EmsrIdeNumero       || '';
    this.codigoActividadTarget.value    = data.CodigoActividad     || '';
    this.nameToEmailTarget.value        = String(data.NameToEmail  ?? 1);
    this.shortNameTarget.value          = data.ShortName           || '';
    this.freightChargesTarget.value     = String(data.FreightCharges ?? 1);
    this.registrofiscal8707Target.value = data.EmsrRegistrofiscal8707 || '';
    this.dbSapTarget.value              = data.DBSap               || '';
    this.isExternalTarget.checked       = !!data.IsExternal;
    this.activeTarget.checked           = data.Active !== false;

    if (data.GroupId)        this.groupIdTarget.value        = String(data.GroupId);
    if (data.SAPConnectionId) this.sapConnectionIdTarget.value = String(data.SAPConnectionId);

    this.#applyIdentificationRules(data.EmsrIdeTipo || '01');

    this.additionalInformationTarget.value = data.AdditionalInformation || '';
    this.#emailCcItems = (data.EmailCC || '').split(';').filter(Boolean);
    if (!this.#emailCcItems.length) this.#emailCcItems = [''];
    this.#renderEmailCc();

    this.certPinTarget.value        = data.CertPin  || '';
    this.certPathTarget.value       = data.CertPath ? data.CertPath.split('\\').pop() : '';
    this.certPathTextTarget.value   = this.certPathTarget.value;
    this.certExpireDateTarget.value = data.CertExpireDate
      ? new Date(data.CertExpireDate).toLocaleDateString('es-CR') : '';
    this.tokenUsrTarget.value  = data.TokenUsr  || '';

    this.logoNameTarget.value        = data.Logo          ? data.Logo.split('\\').pop()          : '';
    this.printFormatNameTarget.value = data.FEPrintFormat ? data.FEPrintFormat.split('\\').pop() : '';

    this.useFactProvTarget.checked = !!data.UseFactProv;
    if (data.UseFactProv) {
      this.#enableSapFields();
      this.sendReceptContainerTarget.classList.remove('hidden');
      this.sendReceptContainerTarget.classList.add('flex');
    }
    this.sendReceptAndApInvTarget.checked = !!data.SendReceptAndApInv;

    this.numSerieProvTarget.value     = data.NumSerieProv    ?? '';
    this.numSerieFactProvTarget.value = data.NumSerieFactProv ?? '';

    if (data.XmlToleranceAmounts?.length) {
      this.#xmlTolerances = [...data.XmlToleranceAmounts];
    }
    this.#renderXmlTolerances();

    if (data.DefaultTaxForXML) this.defaultTaxForXmlTarget.value = data.DefaultTaxForXML;
    if (data.DefaultWareHouse) this.whDefaultTarget.value         = data.DefaultWareHouse;
  }

  // ── Rellenar selects ───────────────────────────────────────────────────────

  #fillGroupsSelect(groups) {
    const select = this.groupIdTarget;
    const current = select.value;
    select.innerHTML = '';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = String(g.Id);
      opt.textContent = g.GroupName;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  #fillSapConnectionsSelect(connections) {
    const select  = this.sapConnectionIdTarget;
    const current = select.value;
    select.innerHTML = '<option value="">-- seleccionar --</option>';
    connections.forEach(c => {
      const opt = document.createElement('option');
      opt.value = String(c.Id);
      opt.textContent = c.Server;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  #fillTaxSelect() {
    const select  = this.defaultTaxForXmlTarget;
    const current = select.value;
    select.innerHTML = '<option value="">-- seleccionar --</option>';
    this.#taxCodeList.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.TaxCode;
      opt.textContent = t.TaxCode;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  #fillWarehouseSelect() {
    const select  = this.whDefaultTarget;
    const current = select.value;
    select.innerHTML = '<option value="">-- seleccionar --</option>';
    this.#warehouseList.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.WhCode;
      opt.textContent = w.WhName;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  // ── Acciones formulario ────────────────────────────────────────────────────

  onFormChange() { this.#validateForm(); }

  onIdentificationTypeChange() {
    this.#applyIdentificationRules(this.identificationTypeTarget.value);
    this.#validateForm();
  }

  #applyIdentificationRules(type) {
    const rules = this.#ideRules[type] ?? { min: 9, max: 9 };
    // setAttribute evita el error de orden min/max al cambiar tipo de identificación:
    // el browser lanza excepción si se asigna minLength > maxLength actual vía propiedad DOM.
    this.identificationTarget.setAttribute('maxlength', String(rules.max));
    this.identificationTarget.setAttribute('minlength', String(rules.min));
  }

  onUseFactProvChange() {
    if (this.useFactProvTarget.checked) {
      this.#enableSapFields();
      this.sendReceptContainerTarget.classList.remove('hidden');
      this.sendReceptContainerTarget.classList.add('flex');
    } else {
      this.#disableSapFields();
      this.sendReceptContainerTarget.classList.add('hidden');
      this.sendReceptContainerTarget.classList.remove('flex');
    }
    this.#validateForm();
  }

  #enableSapFields() {
    this.sapFieldsGroupTarget
      .querySelectorAll('input, select, button')
      .forEach(el => { el.disabled = false; });
  }

  #disableSapFields() {
    this.sapFieldsGroupTarget
      .querySelectorAll('input, select')
      .forEach(el => { el.disabled = true; });
    this.btnAddToleranceTarget.disabled       = true;
    this.btnAddCurrencyMappingTarget.disabled = true;
  }

  // ── Toggle passwords ───────────────────────────────────────────────────────

  toggleCertPin() {
    const input = this.certPinTarget;
    const icon  = this.certPinEyeIconTarget;
    input.type       = input.type === 'password' ? 'text' : 'password';
    icon.textContent = input.type === 'password' ? 'visibility_off' : 'visibility';
  }

  toggleTokenPass() {
    const input = this.tokenPassTarget;
    const icon  = this.tokenPassEyeIconTarget;
    input.type       = input.type === 'password' ? 'text' : 'password';
    icon.textContent = input.type === 'password' ? 'visibility_off' : 'visibility';
  }

  // ── Certificado ────────────────────────────────────────────────────────────

  onCertPinClick() { this.#oldCertPin = this.certPinTarget.value; }

  onCertPinBlur()  { this.#changeCertPin(this.certPinTarget.value); }
  onCertPinEnter() { this.#changeCertPin(this.certPinTarget.value); }

  #changeCertPin(newPin) {
    if (this.#oldCertPin !== newPin && this.#selectedCertFile && newPin) {
      this.#oldCertPin = newPin;
      this.#getCertExpireDate();
    }
  }

  triggerCertUpload() { this.certFileInputTarget.click(); }

  onCertFileSelected() {
    const file = this.certFileInputTarget.files[0];
    if (!file) { this.certPathTarget.value = ''; this.certPathTextTarget.value = ''; return; }

    if (!file.name.endsWith('.p12') && !file.name.endsWith('.pfx')) {
      this.certFileInputTarget.value = '';
      this.#showToast('error', 'Seleccione un certificado con extensión válida (.p12 o .pfx).');
      return;
    }

    this.#selectedCertFile        = file;
    this.certPathTarget.value     = file.name;
    this.certPathTextTarget.value = file.name;

    if (!this.certPinTarget.value) {
      this.#showErrorModal('Pin requerido',
        'Para obtener la fecha de expiración del certificado debe colocar el PIN.');
      return;
    }
    this.#getCertExpireDate();
  }

  async #getCertExpireDate() {
    const pin  = this.certPinTarget.value;
    const file = this.#selectedCertFile;
    if (!pin || !file) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const resp = await fetch(
        `/api/Companies/CheckCertExpireDate?CertPin=${encodeURIComponent(pin)}`,
        { method: 'POST', headers: this.#authHeaders(), body: fd }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      this.certExpireDateTarget.value = json.Data?.CertExpireDate
        ? new Date(json.Data.CertExpireDate).toLocaleDateString('es-CR')
        : '';

      if (!json.Data?.CertExpireDate) {
        this.#showErrorModal('Certificado', json.Message || 'No se pudo obtener la fecha de expiración.');
      }
    } catch (err) {
      this.certExpireDateTarget.value = '';
      this.#showErrorModal('Error de certificado', err.message);
    }
  }

  async downloadCertificate() {
    await this.#downloadBlob(
      `/api/companies/${this.companyIdValue}/certificate`,
      this.certPathTarget.value || 'certificado.pfx'
    );
  }

  // ── Logo ───────────────────────────────────────────────────────────────────

  triggerLogoUpload() { this.logoFileInputTarget.click(); }

  onLogoSelected() {
    const file = this.logoFileInputTarget.files[0];
    if (!file) { this.logoNameTarget.value = ''; return; }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      this.logoFileInputTarget.value = '';
      this.#showToast('error', 'Seleccione un logo con formato válido (JPG, JPEG o PNG).');
      return;
    }
    this.#selectedLogoFile    = file;
    this.logoNameTarget.value = file.name;
  }

  async downloadLogo() {
    await this.#downloadBlob(
      `/api/companies/${this.companyIdValue}/logo`,
      this.logoNameTarget.value || 'logo.png'
    );
  }

  // ── Formato de impresión ───────────────────────────────────────────────────

  triggerPrintFormatUpload() { this.printFormatFileInputTarget.click(); }

  onPrintFormatSelected() {
    const file = this.printFormatFileInputTarget.files[0];
    if (!file) { this.printFormatNameTarget.value = ''; return; }
    if (!file.name.endsWith('.rpt')) {
      this.printFormatFileInputTarget.value = '';
      this.#showToast('error', 'Seleccione un formato de impresión válido (.rpt).');
      return;
    }
    this.#selectedPrintFormatFile   = file;
    this.printFormatNameTarget.value = file.name;
  }

  async downloadPrintFormat() {
    await this.#downloadBlob(
      `/api/companies/${this.companyIdValue}/print-format`,
      this.printFormatNameTarget.value || 'formato-impresion.rpt'
    );
  }

  resetPrintFormat() {
    this.#showConfirmModal(
      'Restablecer formato',
      'Esta acción restablecerá el formato de impresión de la compañía al por defecto. ¿Desea continuar?',
      async () => {
        try {
          await this.#apiFetch(
            `/api/Companies/ResetCompanyPrintFormat?companyId=${this.companyIdValue}`,
            { method: 'PATCH' }
          );
          this.#showToast('success', 'Formato de impresión restablecido con éxito');
        } catch (err) {
          this.#showToast('error', `Error: ${err.message}`);
        }
      }
    );
  }

  // ── EmailCC dinámico ───────────────────────────────────────────────────────

  addEmail() {
    this.#emailCcItems.push('');
    this.#renderEmailCc();
  }

  removeEmail(event) {
    const idx = parseInt(event.currentTarget.dataset.index);
    if (this.#emailCcItems.length === 1) {
      this.#showErrorModal('', 'No se puede eliminar el último registro del correo copia');
      return;
    }
    this.#emailCcItems.splice(idx, 1);
    this.#renderEmailCc();
  }

  #renderEmailCc() {
    const container = this.emailCcListTarget;
    container.innerHTML = '';
    this.#emailCcItems.forEach((email, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.innerHTML = `
        <input type="email"
               data-testid="email-cc-input"
               value="${this.#esc(email)}"
               placeholder="correo@ejemplo.com"
               class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button type="button"
                data-index="${i}"
                data-testid="btn-remove-email-${i}"
                class="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
          <span class="material-icons text-base">remove</span>
        </button>
      `;
      row.querySelector('input').addEventListener('input', e => { this.#emailCcItems[i] = e.target.value; });
      row.querySelector('button').addEventListener('click', e => this.removeEmail(e));
      container.appendChild(row);
    });
  }

  // ── Códigos de actividad ───────────────────────────────────────────────────

  addActivityCode() {
    this.#activityCodes.push({ Code: '', Name: '' });
    this.#renderActivityCodes();
  }

  removeActivityCode(event) {
    const idx = parseInt(event.currentTarget.dataset.index);
    this.#activityCodes.splice(idx, 1);
    this.#renderActivityCodes();
  }

  #renderActivityCodes() {
    const container = this.activityCodesListTarget;
    container.innerHTML = '';

    if (!this.#activityCodes.length) {
      this.activityCodesEmptyTarget.classList.remove('hidden');
      return;
    }
    this.activityCodesEmptyTarget.classList.add('hidden');

    this.#activityCodes.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.setAttribute('data-testid', 'activity-code-row');
      row.innerHTML = `
        <input type="text" placeholder="Código (6)" maxlength="6" minlength="6"
               value="${this.#esc(item.Code)}"
               class="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <input type="text" placeholder="Nombre"
               value="${this.#esc(item.Name)}"
               class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button type="button" data-index="${i}"
                class="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
          <span class="material-icons text-base">delete_outline</span>
        </button>
      `;
      const [codeInput, nameInput] = row.querySelectorAll('input');
      codeInput.addEventListener('input', e => { this.#activityCodes[i].Code = e.target.value; this.#validateActivityCodes(); });
      nameInput.addEventListener('input', e => { this.#activityCodes[i].Name = e.target.value; });
      row.querySelector('button').addEventListener('click', e => this.removeActivityCode(e));
      container.appendChild(row);
    });
    this.#validateActivityCodes();
  }

  #validateActivityCodes() {
    const codes  = this.#activityCodes.map(a => a.Code).filter(Boolean);
    const dupErr = codes.length !== new Set(codes).size;
    this.activityCodesDupErrorTarget.classList.toggle('hidden', !dupErr);
    return !dupErr;
  }

  async saveActivityCodes() {
    if (!this.#validateActivityCodes()) {
      this.#showToast('error', 'Revise los códigos de actividad (duplicados).');
      return;
    }
    try {
      await this.#apiFetch(`/api/Companies/${this.companyIdValue}/activity-codes`, {
        method: 'PUT',
        body:   JSON.stringify(this.#activityCodes.map(({ Code, Name }) => ({ Code, Name }))),
      });
      this.#showToast('success', 'Códigos de actividad actualizados con éxito.');
    } catch (err) {
      this.#showToast('error', `Error: ${err.message}`);
    }
  }

  // ── Tolerancias XML ────────────────────────────────────────────────────────

  addXmlTolerance() {
    this.#xmlTolerances.push({ Tolerance: 0, CurrencyCode: '' });
    this.#renderXmlTolerances();
  }

  removeXmlTolerance(event) {
    this.#xmlTolerances.splice(parseInt(event.currentTarget.dataset.index), 1);
    this.#renderXmlTolerances();
  }

  #renderXmlTolerances() {
    const container = this.xmlToleranceListTarget;
    container.innerHTML = '';

    if (!this.#xmlTolerances.length) {
      this.xmlToleranceEmptyTarget.classList.remove('hidden');
      this.#validateTolerances();
      return;
    }
    this.xmlToleranceEmptyTarget.classList.add('hidden');

    this.#xmlTolerances.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.setAttribute('data-testid', 'xml-tolerance-row');
      row.innerHTML = `
        <select class="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- moneda --</option>
          ${this.#currenciesList.map(c =>
            `<option value="${this.#esc(c.Code)}" ${c.Code === item.CurrencyCode ? 'selected' : ''}>${this.#esc(c.Code)} — ${this.#esc(c.Name)}</option>`
          ).join('')}
        </select>
        <input type="number" min="0" value="${item.Tolerance}" placeholder="Tolerancia"
               class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button type="button" data-index="${i}" data-testid="btn-remove-tolerance-${i}"
                class="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
          <span class="material-icons text-base">delete_outline</span>
        </button>
      `;
      row.querySelector('select').addEventListener('change', e => { this.#xmlTolerances[i].CurrencyCode = e.target.value; this.#validateTolerances(); });
      row.querySelector('input').addEventListener('input', e => { this.#xmlTolerances[i].Tolerance = parseFloat(e.target.value) || 0; });
      row.querySelector('button').addEventListener('click', e => this.removeXmlTolerance(e));
      container.appendChild(row);
    });
    this.#validateTolerances();
  }

  #validateTolerances() {
    const codes  = this.#xmlTolerances.map(t => t.CurrencyCode).filter(Boolean);
    const dupErr = codes.length !== new Set(codes).size;
    this.tolerancesDupErrorTarget.classList.toggle('hidden', !dupErr);
    return !dupErr;
  }

  // ── Mapeo de monedas ───────────────────────────────────────────────────────

  addCurrencyMapping() {
    this.#currencyMappings.push({ Id: 0, XmlCurrencyCode: '', MappedCurrencyCode: '' });
    this.#renderCurrencyMappings();
  }

  removeCurrencyMapping(event) {
    this.#currencyMappings.splice(parseInt(event.currentTarget.dataset.index), 1);
    this.#renderCurrencyMappings();
  }

  #renderCurrencyMappings() {
    const container = this.currencyMappingListTarget;
    container.innerHTML = '';

    if (!this.#currencyMappings.length) {
      this.currencyMappingEmptyTarget.classList.remove('hidden');
      return;
    }
    this.currencyMappingEmptyTarget.classList.add('hidden');

    this.#currencyMappings.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.setAttribute('data-testid', 'currency-mapping-row');
      row.innerHTML = `
        <input type="text" placeholder="Moneda XML" value="${this.#esc(item.XmlCurrencyCode)}"
               class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <select class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- Moneda SAP --</option>
          ${this.#currenciesList.map(c =>
            `<option value="${this.#esc(c.Code)}" ${c.Code === item.MappedCurrencyCode ? 'selected' : ''}>${this.#esc(c.Code)} — ${this.#esc(c.Name)}</option>`
          ).join('')}
        </select>
        <button type="button" data-index="${i}"
                class="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
          <span class="material-icons text-base">delete_outline</span>
        </button>
      `;
      row.querySelector('input').addEventListener('input', e => { this.#currencyMappings[i].XmlCurrencyCode = e.target.value; this.#validateCurrencyMappings(); });
      row.querySelector('select').addEventListener('change', e => { this.#currencyMappings[i].MappedCurrencyCode = e.target.value; });
      row.querySelector('button').addEventListener('click', e => this.removeCurrencyMapping(e));
      container.appendChild(row);
    });
  }

  #validateCurrencyMappings() {
    const codes  = this.#currencyMappings.map(m => m.XmlCurrencyCode).filter(Boolean);
    const dupErr = codes.length !== new Set(codes).size;
    this.currencyMappingsDupErrorTarget.classList.toggle('hidden', !dupErr);
    return !dupErr;
  }

  // ── Recargar listas SAP ────────────────────────────────────────────────────

  async reloadSapDependentLists() {
    const companyId = this.companyIdValue;
    if (!companyId) return;
    try {
      const [warehouseResp, taxResp, currenciesResp] = await Promise.allSettled([
        this.#apiFetch(`/api/warehouse?companyId=${companyId}`),
        this.#apiFetch(`/api/Tax?companyId=${companyId}`),
        this.#apiFetch(`/api/Companies/${companyId}/currencies`),
      ]);
      if (warehouseResp.status === 'fulfilled' && warehouseResp.value?.Data?.length) {
        this.#warehouseList = warehouseResp.value.Data; this.#fillWarehouseSelect();
      }
      if (taxResp.status === 'fulfilled' && taxResp.value?.Data?.length) {
        this.#taxCodeList = taxResp.value.Data; this.#fillTaxSelect();
      }
      if (currenciesResp.status === 'fulfilled' && currenciesResp.value?.Data?.length) {
        this.#currenciesList = currenciesResp.value.Data;
        this.#renderXmlTolerances();
        this.#renderCurrencyMappings();
      }
      this.#showToast('success', 'Información recargada correctamente');
    } catch (err) {
      this.#showToast('error', `Error al recargar: ${err.message}`);
    }
  }

  // ── Guardar por sección ────────────────────────────────────────────────────

  async saveGeneralData() {
    if (!this.#validateGeneralForm()) {
      this.#showToast('error', 'Posee información errónea, verifique los datos generales.');
      return;
    }
    try {
      await this.#sendEditRequest(1);
      this.#showToast('success', 'Datos generales actualizados con éxito.');
    } catch (err) { this.#showToast('error', err.message); }
  }

  async saveAdditionalData() {
    try {
      await this.#sendEditRequest(5);
      this.#showToast('success', 'Información adicional actualizada con éxito.');
    } catch (err) { this.#showToast('error', err.message); }
  }

  async saveAtvData() {
    const identification = this.identificationTarget.value;
    const certPath       = this.certPathTarget.value;
    const tokenUsr       = this.tokenUsrTarget.value.replace(/[^0-9]/g, '');

    if (certPath && !certPath.includes(identification)) {
      this.#showToast('error', 'El nombre del certificado no coincide con la identificación de la compañía.');
      return;
    }
    if (tokenUsr && !tokenUsr.includes(identification)) {
      this.#showToast('error', 'El token del usuario no coincide con la identificación de la compañía.');
      return;
    }
    try {
      await this.#sendEditRequest(2);
      this.#showToast('success', 'Datos de Hacienda actualizados con éxito.');
    } catch (err) { this.#showToast('error', err.message); }
  }

  async saveAttData() {
    try {
      await this.#sendEditRequest(3);
      this.#showToast('success', 'Adjuntos actualizados con éxito.');
    } catch (err) { this.#showToast('error', err.message); }
  }

  async saveSapData() {
    if (!this.useFactProvTarget.checked || !this.#xmlTolerances.length || !this.#validateTolerances()) {
      this.#showToast('error', 'Verifique los datos de factura proveedor (tolerancias requeridas, sin duplicados).');
      return;
    }
    try {
      await this.#sendEditRequest(4);
      await this.#apiFetch(`/api/Companies/${this.companyIdValue}/currency-map`, {
        method: 'PUT',
        body:   JSON.stringify(this.#currencyMappings),
      });
      this.#showToast('success', 'Datos de factura proveedor actualizados con éxito.');
    } catch (err) { this.#showToast('error', err.message); }
  }

  // ── Crear compañía ─────────────────────────────────────────────────────────

  async submitCreate() {
    const identification = this.identificationTarget.value;
    const certPath       = this.certPathTarget.value;
    const tokenUsr       = this.tokenUsrTarget.value.replace(/[^0-9]/g, '');

    if (certPath && !certPath.includes(identification)) {
      this.#showToast('error', 'El nombre del certificado no coincide con la identificación de la compañía.');
      return;
    }
    if (tokenUsr && !tokenUsr.includes(identification)) {
      this.#showToast('error', 'El token del usuario no coincide con la identificación de la compañía.');
      return;
    }
    if (!this.#validateGeneralForm()) {
      this.#showToast('error', 'La información ingresada contiene errores. Verifíquela antes de continuar.');
      return;
    }
    if (this.useFactProvTarget.checked && !this.#xmlTolerances.length) {
      this.#showToast('error', 'Verifique que los datos de factura a proveedor estén correctos.');
      return;
    }

    const companyId = parseInt(this.#selectedCompany?.companyId) || 0;
    const groupId   = parseInt(this.groupIdTarget.value) || parseInt(this.#selectedCompany?.groupId) || 0;

    try {
      const response = await fetch(
        `/api/Companies?companyId=${companyId}&groupId=${groupId}&feToken=`,
        {
          method:  'POST',
          headers: this.#authHeaders({ 'Request-With-Files': 'true', 'API': 'ApiAppUrl' }),
          body:    this.#buildCompanyFormData(),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.Error) throw new Error(json.Message);

      this.#showToast('success', 'Compañía registrada exitosamente.');
      setTimeout(() => { window.location.href = '/configurations/companies'; }, 1200);
    } catch (err) {
      this.#showToast('error', `Error: ${err.message}`);
    }
  }

  // ── Helpers de petición ────────────────────────────────────────────────────

  #buildCompanyFormData() {
    const company = {
      Id:                    this.companyIdValue,
      ComercialName:         this.comercialNameTarget.value,
      LegalName:             this.legalNameTarget.value,
      Identification:        this.identificationTarget.value,
      Type:                  this.identificationTypeTarget.value,
      EmsrIdeTipo:           this.identificationTypeTarget.value,
      EmsrNombre:            this.legalNameTarget.value,
      EmsrNombreComercial:   this.comercialNameTarget.value,
      EmsrIdeNumero:         this.identificationTarget.value,
      CertPin:               this.certPinTarget.value,
      CertPath:              this.certPathTarget.value,
      TokenUsr:              this.tokenUsrTarget.value,
      TokenPass:             this.tokenPassTarget.value,
      AdditionalInformation: this.additionalInformationTarget.value,
      CodigoActividad:       this.codigoActividadTarget.value,
      EmailCC:               this.#emailCcItems.join(';'),
      SAPConnectionId:       parseInt(this.sapConnectionIdTarget.value) || null,
      DBSap:                 this.dbSapTarget.value,
      DBMaestraSap:          '',
      NameToEmail:           parseInt(this.nameToEmailTarget.value),
      ShortName:             this.shortNameTarget.value,
      FreightCharges:        parseInt(this.freightChargesTarget.value),
      UseFactProv:           this.useFactProvTarget.checked,
      IsExternal:            this.isExternalTarget.checked,
      SendReceptAndApInv:    this.sendReceptAndApInvTarget.checked,
      EmsrRegistrofiscal8707: this.registrofiscal8707Target.value,
      Active:                this.activeTarget.checked,
      NumSerieProv:          parseFloat(this.numSerieProvTarget.value) || null,
      NumSerieFactProv:      parseFloat(this.numSerieFactProvTarget.value) || null,
      DefaultTaxForXML:      this.defaultTaxForXmlTarget.value,
      DefaultWareHouse:      this.whDefaultTarget.value,
      XmlToleranceAmounts:   this.#xmlTolerances,
      grant_type: '', client_id: '', EnvironmentId: 0, Attempts: 0, Busy: false,
    };

    const fd = new FormData();
    fd.append('company',           JSON.stringify(company));
    fd.append('file',              this.#selectedCertFile        || new Blob([]));
    fd.append('fileFEPrintFormat', this.#selectedPrintFormatFile || new Blob([]));
    fd.append('fileLogo',          this.#selectedLogoFile        || new Blob([]));
    return fd;
  }

  async #sendEditRequest(action) {
    const groupId  = parseInt(this.groupIdTarget.value) || 0;

    const response = await fetch(
      `/api/Companies?groupId=${groupId}&action=${action}`,
      {
        method:  'PATCH',
        headers: this.#authHeaders({ 'Request-With-Files': 'true' }),
        body:    this.#buildCompanyFormData(),
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.Error) throw new Error(json.Message);
    return json;
  }

  async #downloadBlob(url, filename) {
    try {
      const response = await fetch(url, { headers: this.#authHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      this.#showToast('error', `Error al descargar: ${err.message}`);
    }
  }

  // ── Validación general ─────────────────────────────────────────────────────

  #validateGeneralForm() {
    const id    = this.identificationTarget.value;
    const rules = this.#ideRules[this.identificationTypeTarget.value] ?? { min: 9, max: 9 };
    return !!(
      this.comercialNameTarget.value.trim() &&
      this.legalNameTarget.value.trim() &&
      id.length >= rules.min && id.length <= rules.max &&
      this.codigoActividadTarget.value.length === 6 &&
      this.shortNameTarget.value.trim() &&
      this.dbSapTarget.value.trim() &&
      this.sapConnectionIdTarget.value
    );
  }

  #validateForm() {
    if (this.hasBtnRegisterTarget) {
      this.btnRegisterTarget.disabled = !this.#validateGeneralForm();
    }
  }

  // ── Modales ────────────────────────────────────────────────────────────────

  closeErrorModal() { this.errorModalTarget.classList.add('hidden'); }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  #showConfirmModal(title, subtitle, callback) {
    this.confirmTitleTarget.textContent    = title;
    this.confirmSubtitleTarget.textContent = subtitle;
    this.#confirmCallback = callback;
    this.confirmModalTarget.classList.remove('hidden');
  }

  cancelConfirm() {
    this.#confirmCallback = null;
    this.confirmModalTarget.classList.add('hidden');
  }

  doConfirm() {
    this.confirmModalTarget.classList.add('hidden');
    if (this.#confirmCallback) { this.#confirmCallback(); this.#confirmCallback = null; }
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  #showToast(type, message) {
    const config = {
      success: { bg: 'bg-green-600', icon: 'check_circle'  },
      error:   { bg: 'bg-red-600',   icon: 'error_outline' },
      info:    { bg: 'bg-blue-600',  icon: 'info'          },
      warning: { bg: 'bg-yellow-500', icon: 'warning'      },
    };
    const { bg, icon } = config[type] ?? config.info;

    const toast = this.toastTarget;
    toast.className = `fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-64 max-w-sm ${bg}`;
    this.toastIconTarget.textContent    = icon;
    this.toastMessageTarget.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  #esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Permissions es string[] en sessionStorage */
  #hasPerm(name) { return this.#permissions.includes(name); }

  #authHeaders(extra = {}) {
    const session = Storage.get('Session') || {};
    const token   = session.access_token;
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
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
      const text = await response.text().catch(() => response.statusText);
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // ── Dialog crear conexión ──────────────────────────────────────────────────
  openCreateConnectionDialog() {
    this.#showToast('info', 'Funcionalidad de crear conexión disponible desde el módulo de Conexiones.');
  }
}
