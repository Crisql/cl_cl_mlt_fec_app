import TabulatorController from 'vendor/clavisco/tabulator/controllers/tabulator_controller';
import { Storage, SStore } from 'vendor/clavisco/core';
import { showToast, showAlert, ALERT_TYPES } from 'vendor/clavisco/alerts';
import { TABULATOR_LOCALE, TABULATOR_LANGS, TABULATOR_LOADING_HTML } from 'controllers/tabulator_locale';

/**
 * BranchesController — Gestión de sucursales por compañía (Tabulator).
 *
 * Replica la funcionalidad del componente Angular SucursalComponent:
 *   - Carga inicial: forkJoin de
 *       GET /api/Sucursal/GetSucursalByCompany?companyId={id}
 *       GET /Country.json   (lugares: canton, distrito, barrio)
 *       GET /Provinces.json (provincias)
 *   - Tabla Tabulator: SucursalNum, Alias, Provincia, Cantón, Distrito, Barrio,
 *                      Otras señas, Estado (badge), Acciones (editar)
 *   - Botón "Nueva Sucursal" → panel lateral (crear)
 *   - Botón editar en fila → panel lateral (editar, pre-cargado)
 *   - POST /api/Sucursal   para crear (Id=0)
 *   - PATCH /api/Sucursal  para editar
 *   - Toast éxito / Modal error
 *   - Cascada provincia → cantón → distrito → barrio (autocomplete)
 *
 * JSON locales servidos desde /public:
 *   /Provinces.json → { Provinces: [{ ProvinceId, ProvinceName }] }
 *   /Country.json   → { Country: [{ ProvinceId, CantonId, CantonName,
 *                                   DistrictId, DistrictName,
 *                                   NeighborhoodId, NeighborhoodName }] }
 */
export default class extends TabulatorController {
  static targets = [
    ...TabulatorController.targets,

    // Filtros
    'filterAlias', 'filterProvincia', 'filterCanton', 'filterDistrito',

    // Panel lateral
    'panel', 'panelBackdrop', 'panelTitle',
    'saveBtn', 'saveIcon', 'saveLabel',

    // Campos del formulario
    'inputSucursalNum', 'errorSucursalNum', 'errorSucursalNumPattern',
    'selectProvincia',  'errorProvincia',
    'selectCanton',     'errorCanton',
    'selectDistrito',   'errorDistrito',
    'inputBarrio',      'errorBarrio', 'barrioDropdown',
    'inputOtrasSenas',  'errorOtrasSenas',
    'inputTelefono',    'errorTelefono',
    'inputFax',
    'inputEmail',       'errorEmail', 'errorEmailPattern',
    'inputAlias',       'errorAlias',
    'inputActive',

  ];

  static values = { ...TabulatorController.values };

  // ── Estado ────────────────────────────────────────────────────────────────

  #companyId     = null;
  #branches      = [];       // lista raw de la API
  #provinces     = [];       // [{ ProvinceId, ProvinceName }]
  #country       = [];       // array plano con todos los registros de Country.json
  #neighborhoodList = [];    // barrios del distrito seleccionado
  #editingBranch = null;     // null = crear, objeto = editar
  #provinceId    = '';
  #cantonId      = '';

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    const company   = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;

    super.connect();
    this.#loadInitialData();
  }

  // ── Configuración Tabulator ────────────────────────────────────────────────

  getTableConfig() {
    return {
      ...super.getTableConfig(),
      height:    '100%',
      maxHeight: undefined,
      movableRows: false,
      layout: 'fitColumns',
      placeholder: 'No hay sucursales registradas',
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [10, 20, 50],
      paginationCounter: 'rows',
      locale: TABULATOR_LOCALE,
      langs:  TABULATOR_LANGS,
      dataLoaderLoading: TABULATOR_LOADING_HTML,
      columnDefaults: { headerSort: false },
      columns: this.getColumns(),
    };
  }

  // ── Columnas ──────────────────────────────────────────────────────────────

  getColumns() {
    return [
      { title: 'Sucursal',    field: 'SucursalNum',     width: 90  },
      { title: 'Alias',       field: 'Alias',           minWidth: 120 },
      { title: 'Provincia',   field: 'ProvinciaName',   minWidth: 110 },
      { title: 'Cantón',      field: 'CantonName',      minWidth: 110 },
      { title: 'Distrito',    field: 'DistritoName',    minWidth: 110 },
      { title: 'Barrio',      field: 'EmsrUbBarrio',    minWidth: 110 },
      { title: 'Otras señas', field: 'EmsrUbOtrasSenas',minWidth: 150 },
      {
        title: 'Estado',
        field: 'Active',
        width: 90,
        formatter: (cell) => this.#statusBadge(cell.getValue() ? 'active' : 'inactive'),
      },
      {
        title: 'Acciones',
        field: '_actions',
        width: 80,
        hozAlign: 'center',
        headerSort: false,
        formatter: () => `
          <button type="button"
                  data-action-type="edit"
                  data-tooltip="Editar"
                  class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
            <span class="material-icons text-base">edit</span>
          </button>`,
        cellClick: (_e, cell) => {
          const btn = _e.target.closest('[data-action-type]');
          if (btn?.dataset.actionType === 'edit') {
            this.#openEditPanel(cell.getRow().getData());
          }
        },
      },
    ];
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────

  async #loadInitialData() {
    // 1. JSON locales — independientes de la API, siempre deben cargar
    try {
      const [countryRes, provincesRes] = await Promise.all([
        fetch('/Country.json').then(r => r.json()),
        fetch('/Provinces.json').then(r => r.json()),
      ]);
      this.#country   = countryRes.Country   || [];
      this.#provinces = provincesRes.Provinces || [];
      this.#populateProvinceSelect();
      this.#populateFilterProvinciaSelect();
    } catch (err) {
      showToast('Error al cargar datos de ubicación.', 'error');
    }

    // 2. Sucursales desde la API
    this.table?.alert(TABULATOR_LOADING_HTML);
    try {
      const json = await this.#apiFetch(`/api/Sucursal/GetSucursalByCompany?companyId=${this.#companyId}`);
      if (json.Error || !json.Data?.length) {
        showToast(json.Message || 'No hay sucursales registradas.', 'warning');
        return;
      }
      this.#branches = json.Data.map(b => this.#mapBranchNames(b));
      this.table?.setData(this.#branches);
    } catch (err) {
      showToast(err.message || 'Error al cargar las sucursales.', 'error');
    } finally {
      this.table?.clearAlert();
    }
  }

  /** Agrega campos *Name a partir de los JSON para que la tabla muestre nombres */
  #mapBranchNames(b) {
    return {
      ...b,
      ProvinciaName: this.#getProvinceName(b.EmsrUbProvincia),
      CantonName:    this.#getCantonName(b.EmsrUbProvincia, b.EmsrUbCanton),
      DistritoName:  this.#getDistritoName(b.EmsrUbProvincia, b.EmsrUbCanton, b.EmsrUbDistrito),
    };
  }

  // ── Panel lateral ─────────────────────────────────────────────────────────

  openCreatePanel() {
    this.#editingBranch = null;
    this.panelTitleTarget.textContent = 'Nueva Sucursal';
    this.saveIconTarget.textContent   = 'check';
    this.saveLabelTarget.textContent  = 'Guardar';
    this.#resetForm();
    this.#openPanel();
  }

  #openEditPanel(branch) {
    this.#editingBranch = branch;
    this.panelTitleTarget.textContent = 'Editar Sucursal';
    this.saveIconTarget.textContent   = 'refresh';
    this.saveLabelTarget.textContent  = 'Modificar';
    this.#populateFormForEdit(branch);
    this.#openPanel();
  }

  #openPanel() {
    this.panelBackdropTarget.classList.remove('hidden');
    this.panelTarget.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }

  closePanel() {
    this.panelTarget.classList.add('translate-x-full');
    this.panelBackdropTarget.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  #resetForm() {
    this.inputSucursalNumTarget.value = '';
    this.inputOtrasSenasTarget.value  = '';
    this.inputTelefonoTarget.value    = '';
    this.inputFaxTarget.value         = '';
    this.inputEmailTarget.value       = '';
    this.inputAliasTarget.value       = '';
    this.inputActiveTarget.checked    = true;
    this.inputBarrioTarget.value      = '';
    this.#provinceId = '';
    this.#cantonId   = '';
    this.#neighborhoodList = [];

    // Provincia: solo resetear el valor seleccionado, NO borrar las opciones cargadas
    this.selectProvinciaTarget.value = '';
    // Cantón y Distrito: sí limpiar (dependen de la provincia seleccionada)
    this.#resetSelectTo(this.selectCantonTarget,   'Seleccione...');
    this.#resetSelectTo(this.selectDistritoTarget, 'Seleccione...');
    this.#clearAllErrors();
  }

  #populateFormForEdit(branch) {
    this.#provinceId = branch.EmsrUbProvincia;
    this.#cantonId   = branch.EmsrUbCanton;

    this.inputSucursalNumTarget.value = branch.SucursalNum;
    this.inputOtrasSenasTarget.value  = branch.EmsrUbOtrasSenas;
    this.inputTelefonoTarget.value    = branch.EmsrTlfNumTelefono;
    this.inputFaxTarget.value         = branch.EmsrFaxNumTelefono || '';
    this.inputEmailTarget.value       = branch.EmsrCorreoElectronico;
    this.inputAliasTarget.value       = branch.Alias;
    this.inputActiveTarget.checked    = branch.Active;

    // Cargar selects en cascada
    this.#populateCantonSelect(branch.EmsrUbProvincia);
    this.#populateDistritoSelect(branch.EmsrUbCanton);
    this.#neighborhoodList = this.#getNeighborhoodByDistrict(
      branch.EmsrUbProvincia, branch.EmsrUbCanton, branch.EmsrUbDistrito
    );

    // Seleccionar valores
    this.selectProvinciaTarget.value = branch.EmsrUbProvincia;
    this.selectCantonTarget.value    = branch.EmsrUbCanton;
    this.selectDistritoTarget.value  = branch.EmsrUbDistrito;
    this.inputBarrioTarget.value     = branch.EmsrUbBarrio;

    this.#clearAllErrors();
  }

  // ── Cascada de ubicación ──────────────────────────────────────────────────

  onProvinciaChange(e) {
    const provinciaId = e.target.value;
    this.#provinceId  = provinciaId;
    this.#cantonId    = '';

    this.#populateCantonSelect(provinciaId);

    // Auto-seleccionar primer cantón → primer distrito → primer barrio
    const firstCanton = this.#getUniqueCantons(provinciaId)[0];
    if (firstCanton) {
      this.#cantonId = firstCanton.CantonId;
      this.selectCantonTarget.value = firstCanton.CantonId;
      this.#populateDistritoSelect(firstCanton.CantonId);

      const firstDistrito = this.#getUniqueDistritos(provinciaId, firstCanton.CantonId)[0];
      if (firstDistrito) {
        this.selectDistritoTarget.value = firstDistrito.DistrictId;
        this.#neighborhoodList = this.#getNeighborhoodByDistrict(
          provinciaId, firstCanton.CantonId, firstDistrito.DistrictId
        );
        this.inputBarrioTarget.value = this.#neighborhoodList[0]?.NeighborhoodName || '';
      }
    }
  }

  onCantonChange(e) {
    const cantonId   = e.target.value;
    this.#cantonId   = cantonId;

    this.#populateDistritoSelect(cantonId);

    const firstDistrito = this.#getUniqueDistritos(this.#provinceId, cantonId)[0];
    if (firstDistrito) {
      this.selectDistritoTarget.value = firstDistrito.DistrictId;
      this.#neighborhoodList = this.#getNeighborhoodByDistrict(
        this.#provinceId, cantonId, firstDistrito.DistrictId
      );
      this.inputBarrioTarget.value = this.#neighborhoodList[0]?.NeighborhoodName || '';
    }
  }

  onDistritoChange(e) {
    const districtId = e.target.value;
    this.#neighborhoodList = this.#getNeighborhoodByDistrict(
      this.#provinceId, this.#cantonId, districtId
    );
    this.inputBarrioTarget.value = this.#neighborhoodList[0]?.NeighborhoodName || '';
    this.barrioDropdownTarget.classList.add('hidden');
  }

  // ── Filtros de búsqueda ───────────────────────────────────────────────────

  onFilterProvinciaChange(e) {
    this.#populateFilterCantonSelect(e.target.value);
    this.#resetSelectTo(this.filterDistritoTarget, 'Todos');
  }

  onFilterCantonChange(e) {
    const provinciaId = this.filterProvinciaTarget.value;
    this.#populateFilterDistritoSelect(provinciaId, e.target.value);
  }

  search() {
    const alias      = this.filterAliasTarget.value.trim().toLowerCase();
    const provinciaId = this.filterProvinciaTarget.value;
    const cantonId    = this.filterCantonTarget.value;
    const distritoId  = this.filterDistritoTarget.value;

    const filtered = this.#branches.filter(b => {
      if (alias && !(b.Alias || '').toLowerCase().includes(alias)) return false;
      if (provinciaId && b.EmsrUbProvincia !== provinciaId) return false;
      if (cantonId && b.EmsrUbCanton !== cantonId) return false;
      if (distritoId && b.EmsrUbDistrito !== distritoId) return false;
      return true;
    });

    this.table?.setData(filtered);
  }

  #populateFilterProvinciaSelect() {
    const sel = this.filterProvinciaTarget;
    sel.innerHTML = '<option value="">Todas</option>';
    this.#provinces.forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.ProvinceId;
      opt.textContent = p.ProvinceName;
      sel.appendChild(opt);
    });
  }

  #populateFilterCantonSelect(provinciaId) {
    const sel = this.filterCantonTarget;
    sel.innerHTML = '<option value="">Todos</option>';
    if (provinciaId) {
      this.#getUniqueCantons(provinciaId).forEach(c => {
        const opt = document.createElement('option');
        opt.value       = c.CantonId;
        opt.textContent = c.CantonName;
        sel.appendChild(opt);
      });
    }
  }

  #populateFilterDistritoSelect(provinciaId, cantonId) {
    const sel = this.filterDistritoTarget;
    sel.innerHTML = '<option value="">Todos</option>';
    if (provinciaId && cantonId) {
      this.#getUniqueDistritos(provinciaId, cantonId).forEach(d => {
        const opt = document.createElement('option');
        opt.value       = d.DistrictId;
        opt.textContent = d.DistrictName;
        sel.appendChild(opt);
      });
    }
  }

  // ── Autocomplete barrio ───────────────────────────────────────────────────

  onBarrioInput(e) {
    const q = e.target.value.toLowerCase();
    const filtered = this.#neighborhoodList.filter(n =>
      n.NeighborhoodName.toLowerCase().includes(q)
    );
    this.#renderBarrioDropdown(filtered);
  }

  onBarrioFocus() {
    const q = this.inputBarrioTarget.value.toLowerCase();
    const filtered = this.#neighborhoodList.filter(n =>
      n.NeighborhoodName.toLowerCase().includes(q)
    );
    if (filtered.length) this.#renderBarrioDropdown(filtered);
  }

  onBarrioBlur() {
    // Delay para permitir click en el dropdown
    setTimeout(() => this.barrioDropdownTarget.classList.add('hidden'), 150);
  }

  #renderBarrioDropdown(items) {
    if (!items.length) {
      this.barrioDropdownTarget.classList.add('hidden');
      return;
    }
    this.barrioDropdownTarget.innerHTML = items
      .map(n => `<li class="px-3 py-2 hover:bg-blue-50 cursor-pointer" data-name="${n.NeighborhoodName}">${n.NeighborhoodName}</li>`)
      .join('');
    this.barrioDropdownTarget.classList.remove('hidden');

    this.barrioDropdownTarget.querySelectorAll('li').forEach(li => {
      li.addEventListener('mousedown', () => {
        this.inputBarrioTarget.value = li.dataset.name;
        this.barrioDropdownTarget.classList.add('hidden');
      });
    });
  }

  // ── Solo números ─────────────────────────────────────────────────────────

  onlyNumbers(e) {
    e.target.value = e.target.value.replace(/\D/g, '');
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async saveFromPanel() {
    if (!this.#validate()) return;

    const payload = {
      Id:                  this.#editingBranch?.Id ?? 0,
      CompanyId:           this.#companyId,
      SucursalNum:         parseInt(this.inputSucursalNumTarget.value),
      EmsrUbProvincia:     this.selectProvinciaTarget.value,
      EmsrUbCanton:        this.selectCantonTarget.value,
      EmsrUbDistrito:      this.selectDistritoTarget.value,
      EmsrUbBarrio:        this.inputBarrioTarget.value,
      EmsrUbOtrasSenas:    this.inputOtrasSenasTarget.value.trim(),
      EmsrTlfCodigoPais:   506,
      EmsrTlfNumTelefono:  this.inputTelefonoTarget.value.trim(),
      EmsrFaxCodigoPais:   506,
      EmsrFaxNumTelefono:  this.inputFaxTarget.value.trim() || '',
      EmsrCorreoElectronico: this.inputEmailTarget.value.trim(),
      Active:              this.inputActiveTarget.checked,
      Alias:               this.inputAliasTarget.value.trim(),
    };

    const isEdit  = Boolean(this.#editingBranch?.Id);
    const method  = isEdit ? 'PATCH' : 'POST';
    const msgOk   = isEdit
      ? 'Sucursal actualizada exitosamente.'
      : 'Sucursal registrada exitosamente.';
    const msgErr  = isEdit
      ? 'Error al actualizar la sucursal'
      : 'Error al crear la sucursal';

    this.#setLoading(true);
    try {
      await this.#apiFetch('/api/Sucursal', { method, body: JSON.stringify(payload) });
      showToast(msgOk, 'success');
      this.closePanel();
      await this.#loadInitialData();
    } catch (err) {
      showAlert({ type: ALERT_TYPES.ERROR, title: msgErr, message: err.message });
    } finally {
      this.#setLoading(false);
    }
  }

  #setLoading(on) {
    this.saveBtnTarget.disabled = on;
    this.saveIconTarget.textContent = on ? 'hourglass_empty' : (this.#editingBranch ? 'refresh' : 'check');
  }

  // ── Validación ────────────────────────────────────────────────────────────

  #validate() {
    let valid = true;
    this.#clearAllErrors();

    const num = parseInt(this.inputSucursalNumTarget.value);
    if (!this.inputSucursalNumTarget.value.trim()) {
      this.errorSucursalNumTarget.classList.remove('hidden'); valid = false;
    } else if (isNaN(num) || num <= 0) {
      this.errorSucursalNumPatternTarget.classList.remove('hidden'); valid = false;
    }

    if (!this.selectProvinciaTarget.value) {
      this.errorProvinciaTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.selectCantonTarget.value) {
      this.errorCantonTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.selectDistritoTarget.value) {
      this.errorDistritoTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.inputBarrioTarget.value.trim()) {
      this.errorBarrioTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.inputOtrasSenasTarget.value.trim()) {
      this.errorOtrasSenasTarget.classList.remove('hidden'); valid = false;
    }
    if (!this.inputTelefonoTarget.value.trim()) {
      this.errorTelefonoTarget.classList.remove('hidden'); valid = false;
    }

    const email = this.inputEmailTarget.value.trim();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$/;
    if (!email) {
      this.errorEmailTarget.classList.remove('hidden'); valid = false;
    } else if (!emailRegex.test(email)) {
      this.errorEmailPatternTarget.classList.remove('hidden'); valid = false;
    }

    if (!this.inputAliasTarget.value.trim()) {
      this.errorAliasTarget.classList.remove('hidden'); valid = false;
    }

    return valid;
  }

  #clearAllErrors() {
    [
      'errorSucursalNum', 'errorSucursalNumPattern',
      'errorProvincia', 'errorCanton', 'errorDistrito', 'errorBarrio',
      'errorOtrasSenas', 'errorTelefono',
      'errorEmail', 'errorEmailPattern',
      'errorAlias',
    ].forEach(t => this[`${t}Target`]?.classList.add('hidden'));
  }

  // ── Helpers de ubicación ──────────────────────────────────────────────────

  #populateProvinceSelect() {
    const sel = this.selectProvinciaTarget;
    sel.innerHTML = '<option value="">Seleccione...</option>';
    this.#provinces.forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.ProvinceId;
      opt.textContent = p.ProvinceName;
      sel.appendChild(opt);
    });
  }

  #populateCantonSelect(provinciaId) {
    const cantons = this.#getUniqueCantons(provinciaId);
    const sel     = this.selectCantonTarget;
    sel.innerHTML = '<option value="">Seleccione...</option>';
    cantons.forEach(c => {
      const opt = document.createElement('option');
      opt.value       = c.CantonId;
      opt.textContent = c.CantonName;
      sel.appendChild(opt);
    });
    this.#resetSelectTo(this.selectDistritoTarget, 'Seleccione...');
    this.inputBarrioTarget.value = '';
    this.#neighborhoodList = [];
  }

  #populateDistritoSelect(cantonId) {
    const distritos = this.#getUniqueDistritos(this.#provinceId, cantonId);
    const sel       = this.selectDistritoTarget;
    sel.innerHTML = '<option value="">Seleccione...</option>';
    distritos.forEach(d => {
      const opt = document.createElement('option');
      opt.value       = d.DistrictId;
      opt.textContent = d.DistrictName;
      sel.appendChild(opt);
    });
    this.inputBarrioTarget.value = '';
    this.#neighborhoodList = [];
  }

  #getUniqueCantons(provinciaId) {
    const seen = new Set();
    return this.#country
      .filter(r => r.ProvinceId === provinciaId)
      .filter(r => {
        if (seen.has(r.CantonId)) return false;
        seen.add(r.CantonId);
        return true;
      })
      .map(r => ({ CantonId: r.CantonId, CantonName: r.CantonName }));
  }

  #getUniqueDistritos(provinciaId, cantonId) {
    const seen = new Set();
    return this.#country
      .filter(r => r.ProvinceId === provinciaId && r.CantonId === cantonId)
      .filter(r => {
        if (seen.has(r.DistrictId)) return false;
        seen.add(r.DistrictId);
        return true;
      })
      .map(r => ({ DistrictId: r.DistrictId, DistrictName: r.DistrictName }));
  }

  #getNeighborhoodByDistrict(provinciaId, cantonId, districtId) {
    const seen = new Set();
    return this.#country
      .filter(r => r.ProvinceId === provinciaId && r.CantonId === cantonId && r.DistrictId === districtId)
      .filter(r => {
        if (seen.has(r.NeighborhoodId)) return false;
        seen.add(r.NeighborhoodId);
        return true;
      })
      .map(r => ({ NeighborhoodId: r.NeighborhoodId, NeighborhoodName: r.NeighborhoodName }));
  }

  #getProvinceName(provinciaId) {
    return this.#provinces.find(p => p.ProvinceId === provinciaId)?.ProvinceName || provinciaId;
  }

  #getCantonName(provinciaId, cantonId) {
    return this.#country.find(r => r.ProvinceId === provinciaId && r.CantonId === cantonId)?.CantonName || cantonId;
  }

  #getDistritoName(provinciaId, cantonId, districtId) {
    return this.#country.find(r =>
      r.ProvinceId === provinciaId && r.CantonId === cantonId && r.DistrictId === districtId
    )?.DistrictName || districtId;
  }

  #resetSelectTo(sel, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
  }

  // ── Badge de estado ───────────────────────────────────────────────────────

  #statusBadge(status) {
    const map = {
      active:   { bg: '#e8f5ee', color: '#3a7d52', label: 'Activo'   },
      inactive: { bg: '#fdecea', color: '#c0392b', label: 'Inactivo' },
    };
    const { bg, color, label } = map[status] ?? { bg: '#f3f4f6', color: '#4b5563', label: status };
    return `<span style="background-color:${bg}; color:${color};"
                 class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
      ${label}
    </span>`;
  }

  // ── apiFetch ──────────────────────────────────────────────────────────────

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

    const hasBody = response.status !== 204 &&
                    response.headers.get('content-length') !== '0' &&
                    response.headers.get('content-type')?.includes('application/json');
    if (!hasBody) return { Message: decodedMessage || null };

    const json = await response.json();
    if (decodedMessage && !json.Message) json.Message = decodedMessage;
    return json;
  }
}
