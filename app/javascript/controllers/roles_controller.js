import { Controller } from '@hotwired/stimulus';
import { Storage, SStore } from 'vendor/clavisco/core';

/**
 * RolesController — Gestión de roles por compañía.
 *
 * Replica la funcionalidad del componente Angular RolComponent:
 *   - Carga inicial: GET api/Rol/GetRoles?companyId={id}
 *   - Tabla con columnas: Nombre del Rol, Activo? (icono thumb_up/thumb_down)
 *   - Botón "Nuevo" → abre modal crear
 *   - Botón "Editar" por fila → abre modal editar (OWNER bloqueado)
 *   - POST api/Rol para crear (Id=0, Active=true, GroupId=0)
 *   - PATCH api/Rol para editar
 *   - Toast de éxito / modal de error
 */
export default class extends Controller {
  static targets = [
    'table',
    'tbody',
    'emptyState',
    'loadingState',
    'modal',
    'nameInput',
    'nameError',
    'submitBtn',
    'submitIcon',
    'submitLabel',
    'toast',
    'toastIcon',
    'toastMessage',
    'errorModal',
    'errorTitle',
    'errorSubtitle',
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────

  /** Lista de roles cargados desde la API */
  #roles = [];

  /** Rol en edición (null si es creación) */
  #editingRole = null;

  /** companyId leído del storage */
  #companyId = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connect() {
    this.#onLoad();
  }

  // ── Inicialización ────────────────────────────────────────────────────────

  #onLoad() {
    const company = SStore.get('CurrentCompany');
    this.#companyId = company?.companyId ? parseInt(company.companyId) : null;
    this.#loadRoles();
  }

  // ── API ───────────────────────────────────────────────────────────────────

  async #loadRoles() {
    this.#setLoading(true);
    try {
      const json = await this.#apiFetch(`/api/Rol/GetRoles?companyId=${this.#companyId}`);

      if (json.Error || !json.Data) {
        this.#showErrorModal(
          'Se produjo un error al obtener los roles',
          json.Message || 'Error desconocido'
        );
        return;
      }

      this.#roles = json.Data;
      this.#renderTable();
    } catch (err) {
      this.#showErrorModal('Se produjo un error al obtener los roles', err.message);
    } finally {
      this.#setLoading(false);
    }
  }

  async #createRole(name) {
    const payload = {
      role: { Id: 0, Name: name, Active: true, GroupId: 0 },
      companyId: this.#companyId,
    };
    return this.#apiFetch('/api/Rol', { method: 'POST', body: JSON.stringify(payload) });
  }

  async #updateRole(id, name) {
    const payload = {
      role: { Id: id, Name: name, Active: true, GroupId: 0 },
      companyId: this.#companyId,
    };
    return this.#apiFetch('/api/Rol', { method: 'PATCH', body: JSON.stringify(payload) });
  }

  // ── Tabla ─────────────────────────────────────────────────────────────────

  #renderTable() {
    if (this.#roles.length === 0) {
      this.tbodyTarget.innerHTML = '';
      this.emptyStateTarget.classList.remove('hidden');
      return;
    }

    this.emptyStateTarget.classList.add('hidden');
    this.tbodyTarget.innerHTML = this.#roles.map(role => this.#rowHTML(role)).join('');
  }

  #rowHTML(role) {
    return `
      <tr data-testid="role-row-${role.Id}"
          class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">${this.#escapeHTML(role.Name)}</td>
        <td class="px-4 py-3">
          ${this.#statusBadge(role.Active)}
        </td>
        <td class="px-4 py-3">
          <div class="relative group inline-block">
            <button type="button"
                    data-testid="btn-edit-role-${role.Id}"
                    data-action="click->roles#onEditClick"
                    data-role-id="${role.Id}"
                    class="p-1.5 text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer">
              <span class="material-icons text-base">edit</span>
            </button>
            <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                         whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-xs text-white
                         opacity-0 group-hover:opacity-100 transition-opacity z-10">
              Editar
            </span>
          </div>
        </td>
      </tr>
    `;
  }

  #statusBadge(active) {
    return active
      ? `<span style="background-color:#e8f5ee; color:#3a7d52;" class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Activo</span>`
      : `<span style="background-color:#fdecea; color:#c0392b;" class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">Inactivo</span>`;
  }

  // ── Handlers de eventos ───────────────────────────────────────────────────

  openCreateModal() {
    this.#editingRole = null;
    this.#resetModal();
    this.submitIconTarget.textContent  = 'check';
    this.submitLabelTarget.textContent = 'Crear';
    this.#openModal();
  }

  onEditClick(event) {
    const roleId = parseInt(event.currentTarget.dataset.roleId);
    const role   = this.#roles.find(r => r.Id === roleId);
    if (!role) return;

    if (role.Name === 'OWNER') {
      this.#showToast('Este rol no permite su edición', 'info');
      return;
    }

    this.#editingRole = role;
    this.#resetModal();
    this.nameInputTarget.value         = role.Name;
    this.submitBtnTarget.disabled      = false;
    this.submitIconTarget.textContent  = 'autorenew';
    this.submitLabelTarget.textContent = 'Modificar';
    this.#openModal();
  }

  onNameInput() {
    const hasValue = this.nameInputTarget.value.trim().length > 0;
    this.submitBtnTarget.disabled = !hasValue;
    if (hasValue) {
      this.nameErrorTarget.classList.add('hidden');
    } else {
      this.nameErrorTarget.classList.remove('hidden');
    }
  }

  async onSubmit() {
    const name = this.nameInputTarget.value.trim();
    if (!name) return;

    try {
      if (this.#editingRole) {
        await this.#updateRole(this.#editingRole.Id, name);
        this.#showToast('Se actualizó el rol correctamente!!!', 'success');
      } else {
        await this.#createRole(name);
        this.#showToast('Se creó el rol correctamente!!!', 'success');
      }
      this.closeModal();
      await this.#loadRoles();
    } catch (err) {
      const action = this.#editingRole ? 'actualizar' : 'registrar';
      this.#showErrorModal(`Se produjo un error al ${action} el rol`, err.message);
    }
  }

  closeModal() {
    this.modalTarget.classList.add('hidden');
  }

  closeErrorModal() {
    this.errorModalTarget.classList.add('hidden');
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  #openModal() {
    this.modalTarget.classList.remove('hidden');
    this.nameInputTarget.focus();
  }

  #resetModal() {
    this.nameInputTarget.value    = '';
    this.submitBtnTarget.disabled = true;
    this.nameErrorTarget.classList.add('hidden');
  }

  #setLoading(loading) {
    this.loadingStateTarget.classList.toggle('hidden', !loading);
    if (loading) this.tbodyTarget.innerHTML = '';
  }

  #showToast(message, type = 'success') {
    const toast = this.toastTarget;
    const iconEl = this.toastIconTarget;
    const msgEl  = this.toastMessageTarget;

    const config = {
      success: { bg: 'bg-green-500', icon: 'check_circle' },
      info:    { bg: 'bg-blue-500',  icon: 'info'          },
      error:   { bg: 'bg-red-500',   icon: 'error'         },
    }[type] ?? { bg: 'bg-gray-700', icon: 'notifications' };

    iconEl.textContent  = config.icon;
    msgEl.textContent   = message;
    toast.className     = `fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm text-white max-w-sm transition-all duration-300 ${config.bg}`;

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  #showErrorModal(title, subtitle) {
    this.errorTitleTarget.textContent    = title;
    this.errorSubtitleTarget.textContent = subtitle;
    this.errorModalTarget.classList.remove('hidden');
  }

  async #apiFetch(url, options = {}) {
    const session = Storage.get('Session') || {};
    const token   = session.access_token;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'API': 'ApiAppUrl',
        'X-Skip-Error-Interceptor': 'true',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }

    const contentType   = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || (!contentType.includes('json') && !contentType.includes('text'))) return {};

    const text = await response.text();
    if (!text || !text.trim()) return {};
    return JSON.parse(text);
  }

  #escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
