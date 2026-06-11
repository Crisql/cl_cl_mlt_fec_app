import { Controller } from '@hotwired/stimulus'
import { initSessionSync } from 'vendor/clavisco/session-sync'

/**
 * SessionSyncController — Thin controller de arranque
 *
 * Equivalente a AppComponent.RegisterContext() en el legacy Angular.
 * Su única responsabilidad es llamar initSessionSync() en connect()
 * para que el BroadcastChannel esté activo mientras la página vive.
 *
 * Se monta en ambos layouts (protected y application) para que el listener
 * esté disponible tanto en páginas autenticadas como en /login.
 */
export default class extends Controller {
  connect() {
    initSessionSync()
  }
}
