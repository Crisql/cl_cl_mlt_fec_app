/**
 * session-sync — Módulo de sincronización entre pestañas
 *
 * Equivalente a BroadcastChannelService de Angular.
 * Canal: 'fe-app-channel' (mismo nombre que el legacy para compatibilidad).
 *
 * API pública:
 *   initSessionSync()           — registra el canal y el handler (idempotente)
 *   notifySessionOpened()       — postMessage OPEN_SESSION
 *   notifySessionClosed()       — postMessage CLOSE_SESSION
 *   thereAreMultipleContexts()  — Promise<boolean> con timeout 250 ms
 *   clearSession()              — limpia todo el storage de sesión
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CHANNEL_NAME = 'fe-app-channel'

const MSG = Object.freeze({
  OPEN_SESSION:              'OPEN_SESSION',
  CLOSE_SESSION:             'CLOSE_SESSION',
  VERIFY_MULTIPLE_CONTEXTS:  'VERIFY_MULTIPLE_CONTEXTS',
  MULTIPLE_CONTEXT_VERIFIED: 'MULTIPLE_CONTEXT_VERIFIED',
})

// Claves de localStorage que pertenecen a la sesión
const LS_SESSION_KEYS = [
  'Session', 'UserAssign', 'DocumentInMemories', 'CurrentSession',
  'Ports', 'Menu', 'LocalPrinter', 'ReportManager', 'UserInfo',
  'Companies', 'menuState', 'BannerUser', 'FavoriteCompany',
]

// Claves de sessionStorage (por pestaña)
const SS_SESSION_KEYS = ['CurrentCompany', 'Permissions', 'currentFEUser']

// ---------------------------------------------------------------------------
// Estado interno del módulo (singleton por carga de página)
// ---------------------------------------------------------------------------

let _channel       = null
let _guid          = null
let _initialized   = false

// Subject de verificación en curso (resuelto por MULTIPLE_CONTEXT_VERIFIED)
let _verifyResolve = null

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

function _postMessage(type) {
  _channel?.postMessage({ type, guid: _guid })
}

function _onMessage({ data }) {
  if (!data?.type || data.guid === _guid) return

  switch (data.type) {
    case MSG.OPEN_SESSION:
      // Otra pestaña abrió sesión — limpiar datos por pestaña y re-sincronizar
      SS_SESSION_KEYS.forEach(k => sessionStorage.removeItem(k))
      window.location.href = '/home'
      break

    case MSG.CLOSE_SESSION:
      // Otra pestaña cerró sesión — cerrar en silencio (sin confirmación)
      clearSession()
      window.location.href = '/login'
      break

    case MSG.VERIFY_MULTIPLE_CONTEXTS:
      // Alguien preguntó si hay más pestañas → responder que sí
      _postMessage(MSG.MULTIPLE_CONTEXT_VERIFIED)
      break

    case MSG.MULTIPLE_CONTEXT_VERIFIED:
      // La verificación en curso recibió respuesta positiva
      if (_verifyResolve) {
        _verifyResolve(true)
        _verifyResolve = null
      }
      break
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Inicializa el canal y asigna el handler de mensajes.
 * Idempotente: llamadas posteriores no crean un canal duplicado.
 */
export function initSessionSync() {
  if (_initialized) return
  _initialized = true

  if (typeof BroadcastChannel === 'undefined') return

  _guid    = crypto.randomUUID()
  _channel = new BroadcastChannel(CHANNEL_NAME)
  _channel.onmessage = _onMessage
}

/**
 * Notifica a las demás pestañas que se abrió una sesión.
 * Llamar tras login exitoso.
 */
export function notifySessionOpened() {
  _postMessage(MSG.OPEN_SESSION)
}

/**
 * Notifica a las demás pestañas que se cerró la sesión.
 * Llamar solo desde quien origina el logout (menú), nunca desde el receptor.
 */
export function notifySessionClosed() {
  _postMessage(MSG.CLOSE_SESSION)
}

/**
 * Verifica si hay otras pestañas activas con la app abierta.
 * Envía VERIFY_MULTIPLE_CONTEXTS y espera 250 ms una respuesta.
 *
 * @returns {Promise<boolean>}
 */
export function thereAreMultipleContexts() {
  return new Promise(resolve => {
    if (!_channel) { resolve(false); return }

    _verifyResolve = resolve
    _postMessage(MSG.VERIFY_MULTIPLE_CONTEXTS)

    setTimeout(() => {
      if (_verifyResolve) {
        _verifyResolve(false)
        _verifyResolve = null
      }
    }, 250)
  })
}

/**
 * Elimina todos los datos de sesión del storage.
 * Centralizado aquí para evitar duplicación entre menu_controller,
 * auth_guard_controller y el handler de CLOSE_SESSION.
 */
export function clearSession() {
  LS_SESSION_KEYS.forEach(k => localStorage.removeItem(k))
  SS_SESSION_KEYS.forEach(k => sessionStorage.removeItem(k))
}
