/**
 * @clavisco/login - Authentication service
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus
 */

import { Storage, clPrint, CL_DISPLAY, getError } from 'vendor/clavisco/core'
import { publish } from 'vendor/clavisco/linker'

// ============================================================
// AUTH SERVICE
// ============================================================

class AuthService {
  constructor() {
    this.isAuthenticated = false
    this.user = null
    this.companies = []
    this.currentCompany = null
  }

  /**
   * Login with username and password
   * @param {string} username - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Auth result
   */
  async login(username, password) {
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username,
          password
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error_description || 'Error de autenticación')
      }

      const data = await response.json()

      // Store session (include UserEmail from OAuth token response properties)
      Storage.set('Session', {
        access_token: data.access_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        expires_at: Date.now() + (data.expires_in * 1000),
        UserEmail: data.UserEmail || '',
        UserId: data.UserId || ''
      })

      this.isAuthenticated = true

      // Get user info
      await this.loadUserInfo()

      // Publish login event
      publish({
        View: 'login',
        Target: 'success',
        Data: { user: this.user }
      })

      return { success: true, user: this.user }

    } catch (error) {
      clPrint(error, CL_DISPLAY.ERROR)
      return { success: false, error: getError(error) }
    }
  }

  /**
   * Load user information
   */
  async loadUserInfo() {
    try {
      const response = await fetch('/api/Users/GetUserInfo', {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.user = data.Data || data
        Storage.set('UserInfo', this.user)
      }
    } catch (error) {
      clPrint('Error loading user info', CL_DISPLAY.WARNING)
    }
  }

  /**
   * Load available companies
   * @returns {Promise<Array>} Companies list
   */
  async loadCompanies() {
    try {
      const response = await fetch('/api/Companies', {
        headers: {
          'Authorization': `Bearer ${Storage.getToken()}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        this.companies = data.Data || data || []
        Storage.set('Companies', this.companies)
        return this.companies
      }

      return []
    } catch (error) {
      clPrint('Error loading companies', CL_DISPLAY.WARNING)
      return []
    }
  }

  /**
   * Select current company
   * @param {Object} company - Company to select
   */
  selectCompany(company) {
    this.currentCompany = company
    Storage.set('CurrentCompany', company)

    publish({
      View: 'login',
      Target: 'companySelected',
      Data: company
    })
  }

  /**
   * Logout user
   */
  logout() {
    this.isAuthenticated = false
    this.user = null
    this.currentCompany = null

    Storage.remove('Session')
    Storage.remove('UserInfo')
    Storage.remove('CurrentCompany')
    Storage.remove('Companies')

    publish({
      View: 'login',
      Target: 'logout',
      Data: null
    })

    // Redirect to login
    if (window.Turbo) {
      window.Turbo.visit('/login')
    } else {
      window.location.href = '/login'
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Auth status
   */
  checkAuth() {
    const session = Storage.getSession()

    if (!session || !session.access_token) {
      this.isAuthenticated = false
      return false
    }

    // Check expiration
    if (session.expires_at && Date.now() > session.expires_at) {
      this.logout()
      return false
    }

    this.isAuthenticated = true
    this.user = Storage.get('UserInfo')
    this.currentCompany = Storage.getCurrentCompany()

    return true
  }

  /**
   * Refresh token
   * @returns {Promise<boolean>} Success status
   */
  async refreshToken() {
    // For now, just re-login is required
    // Could implement refresh_token flow if API supports it
    return false
  }

  /**
   * Get current user
   * @returns {Object|null} User object
   */
  getUser() {
    return this.user || Storage.get('UserInfo')
  }

  /**
   * Get current company
   * @returns {Object|null} Company object
   */
  getCompany() {
    return this.currentCompany || Storage.getCurrentCompany()
  }

  /**
   * Check if user has permission
   * @param {string} permissionCode - Permission code
   * @returns {boolean} Has permission
   */
  hasPermission(permissionCode) {
    const user = this.getUser()
    if (!user || !user.Permissions) return false

    return user.Permissions.some(p =>
      p.Code === permissionCode && p.Status === true
    )
  }
}

// Singleton instance
const auth = new AuthService()

// ============================================================
// EXPORTS
// ============================================================

export const Auth = auth

export function login(username, password) {
  return auth.login(username, password)
}

export function logout() {
  auth.logout()
}

export function checkAuth() {
  return auth.checkAuth()
}

export function getUser() {
  return auth.getUser()
}

export function getCompany() {
  return auth.getCompany()
}

export function loadCompanies() {
  return auth.loadCompanies()
}

export function selectCompany(company) {
  auth.selectCompany(company)
}

export function hasPermission(code) {
  return auth.hasPermission(code)
}

export default {
  Auth,
  login,
  logout,
  checkAuth,
  getUser,
  getCompany,
  loadCompanies,
  selectCompany,
  hasPermission
}
