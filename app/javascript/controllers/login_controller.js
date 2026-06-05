import { Controller } from '@hotwired/stimulus'
import { login, checkAuth } from 'vendor/clavisco/login'
import { Storage } from 'vendor/clavisco/core'
import { showToast } from 'vendor/clavisco/alerts'

// Stimulus controller para /login
// Vendor: vendor/clavisco/login maneja OAuth2 y storage
// Custom: recover password, change password, form switching, validaciones UI
export default class extends Controller {
  static targets = [
    'email', 'password', 'emailError', 'passwordError',
    'submitButton', 'buttonText', 'buttonLoading', 'eyeIcon',
    'loginForm', 'recoverForm', 'changePasswordForm',
    'recoverEmail',
    'changeEmail', 'currentPassword', 'newPassword', 'confirmPassword',
  ]

  static values = {
    apiUrl:            { type: String,  default: '/api/token' },
    redirectPath:      { type: String,  default: '/home' },
    sessionName:       { type: String,  default: 'Session' },
    // Límites de contraseña — mantener sincronizados con maxlength/minlength en new.html.erb
    minPasswordLength: { type: Number,  default: 8 },
    maxPasswordLength: { type: Number,  default: 30 },
    // Límite de email — mantener sincronizado con maxlength en new.html.erb
    maxEmailLength:    { type: Number,  default: 450 }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connect() {
    if (checkAuth()) {
      window.location.href = this.redirectPathValue
    }
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  async login() {
    const email    = this.emailTarget.value.trim()
    const password = this.passwordTarget.value

    this.#hideError(this.emailErrorTarget)
    this.#hideError(this.passwordErrorTarget)

    if (!email || !this.#isValidEmail(email)) {
      this.#showError(this.emailErrorTarget, 'Ingrese un correo electrónico válido')
      return
    }

    if (!password || password.length < this.minPasswordLengthValue) {
      this.#showError(this.passwordErrorTarget, `La contraseña debe tener un mínimo de ${this.minPasswordLengthValue} caracteres`)
      return
    }

    this.#setLoading(true)

    try {
      // Pasar el tokenUrl directo al API externo (evita el proxy Rails / Cloudflare)
      const result = await login(email, password, this.apiUrlValue)

      if (result.success) {
        if(result.response.companyId)
        {
          Storage.set("FavoriteCompany", {
            companyName: result.response.CompanyName,
            companyId: result.response.companyId,
            codigoActividad: result.response.CodigoActividad,
            groupId: result.response.GroupId,
            UseFactProv: result.response.UseFactProv,
            SendReceptAndApInv: result.response.SendReceptAndApInv
          });
        }
        window.location.href = this.redirectPathValue
      } else {
        showToast(result.error || 'Error de autenticación', 'error')
      }
    } catch (error) {
      console.error('Login error:', error)
      showToast('Error de conexión. Intente nuevamente.', 'error')
    } finally {
      this.#setLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Toggle password visibility
  // -------------------------------------------------------------------------

  togglePassword() {
    const input = this.passwordTarget
    const isPassword = input.type === 'password'
    input.type = isPassword ? 'text' : 'password'

    this.eyeIconTarget.innerHTML = isPassword
      ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>`
  }

  // -------------------------------------------------------------------------
  // Form switching
  // -------------------------------------------------------------------------

  showRecoverPassword(event) {
    event.preventDefault()
    this.loginFormTarget.classList.add('hidden')
    this.changePasswordFormTarget.classList.add('hidden')
    this.recoverFormTarget.classList.remove('hidden')
    history.replaceState(null, '', '/#/recovery')
  }

  showChangePassword(event) {
    event.preventDefault()
    this.loginFormTarget.classList.add('hidden')
    this.recoverFormTarget.classList.add('hidden')
    this.changePasswordFormTarget.classList.remove('hidden')
    history.replaceState(null, '', '/#/change-password')
  }

  showLogin(event) {
    event.preventDefault()
    this.recoverFormTarget.classList.add('hidden')
    this.changePasswordFormTarget.classList.add('hidden')
    this.loginFormTarget.classList.remove('hidden')
    history.replaceState(null, '', '/#/login')
  }

  // -------------------------------------------------------------------------
  // Recover password
  // -------------------------------------------------------------------------

  async sendRecoverEmail() {
    const email = this.recoverEmailTarget.value.trim()

    if (!email || !this.#isValidEmail(email)) {
      showToast('Ingrese un correo electrónico válido', 'error')
      return
    }

    try {
      const response = await fetch(`/api/Passwords?userEmail=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (response.ok) {
        showToast(data.Message || 'Correo de recuperación enviado', 'success')
        this.showLogin({ preventDefault: () => {} })
      } else {
        showToast(data.Message || 'Error al enviar correo', 'error')
      }
    } catch (error) {
      console.error('Recovery error:', error)
      showToast('Error de conexión', 'error')
    }
  }

  // -------------------------------------------------------------------------
  // Change password
  // -------------------------------------------------------------------------

  async changePassword() {
    const email           = this.changeEmailTarget.value.trim()
    const currentPassword = this.currentPasswordTarget.value
    const newPassword     = this.newPasswordTarget.value
    const confirmPassword = this.confirmPasswordTarget.value

    if (!email || !this.#isValidEmail(email)) {
      showToast('Ingrese un correo electrónico válido', 'error')
      return
    }

    if (newPassword.length > this.maxPasswordLengthValue) {
      showToast(`La contraseña no puede superar ${this.maxPasswordLengthValue} caracteres`, 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error')
      return
    }

    if (newPassword.length < this.minPasswordLengthValue) {
      showToast(`La contraseña debe tener un mínimo de ${this.minPasswordLengthValue} caracteres`, 'error')
      return
    }

    try {
      const response = await fetch('/api/Passwords/ChangePassword', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword: newPassword,
          email: email
        })
      })

      const data = await response.json()

      if (response.ok) {
        showToast(data.Message || 'Contraseña cambiada exitosamente', 'success')
        this.showLogin({ preventDefault: () => {} })
      } else {
        showToast(data.Message || 'Error al cambiar contraseña', 'error')
      }
    } catch (error) {
      console.error('Change password error:', error)
      showToast('Error de conexión', 'error')
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  #isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  #showError(element, message) {
    element.textContent = message
    element.classList.remove('hidden')
  }

  #hideError(element) {
    element.classList.add('hidden')
  }

  #setLoading(loading) {
    this.submitButtonTarget.disabled = loading
    this.buttonTextTarget.classList.toggle('hidden', loading)
    this.buttonLoadingTarget.classList.toggle('hidden', !loading)
  }

}
