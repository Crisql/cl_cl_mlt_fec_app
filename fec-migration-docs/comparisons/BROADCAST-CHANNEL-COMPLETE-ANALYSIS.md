# BroadcastChannel / Sincronización entre pestañas — Análisis y Plan de Migración

> Funcionalidad cross-cutting (no es un módulo de página). Coordina apertura y cierre
> de sesión entre pestañas/ventanas del mismo origen mediante `BroadcastChannel`.

---

## 1. Análisis exhaustivo del legacy (Angular)

### 1.1 Archivos involucrados

| Archivo | Rol |
|---|---|
| `core/services/broadcast-channel.service.ts` | Servicio singleton. Canal `fe-app-channel`, emite/recibe mensajes. |
| `core/services/logout.service.ts` | Máquina de estado del **origen** del logout/login (3 flags mutuamente excluyentes). |
| `core/guards/logout.guard.ts` | `canActivate` sobre la ruta `/login`. Decide qué hacer según el origen. |
| `core/enums/enums.ts` (`BroadcastChannelMessageType`) | Tipos de mensaje del canal. |
| `app.component.ts` | `RegisterContext()` en el constructor (boot) + `ListenNavigationEvents()` que dispara `authentication.logout()` al llegar a `/login`. |
| `Interceptors/login.interceptor.ts` | Tras `api/token` OK → `NotifyUserSessionOpened()`. |
| `shared/menu/menu.component.ts` | Click en logout → `IsLogoutFromMenu = true` + `navigate(['login'])`. |

### 1.2 Tipos de mensaje (`BroadcastChannelMessageType`)

```
OPEN_SESSION              = 'OPEN_SESSION'
CLOSE_SESSION             = 'CLOSE_SESSION'
VERIFY_MULTIPLE_CONTEXTS  = 'VERIFY_MULTIPLE_CONTEXTS'
MULTIPLE_CONTEXT_VERIFIED = 'MULTIPLE_CONTEXT_VERIFIED'
```

Cada mensaje viaja como `{ type, guid }`. El `guid` es un `crypto.randomUUID()` por contexto
(pestaña). El handler **ignora los mensajes con su propio guid** (no se auto-escucha).

### 1.3 API del servicio

| Método | Acción | Quién lo llama |
|---|---|---|
| `RegisterContext()` | Asigna `onmessage` y genera `CONTEXT_GUID`. | `AppComponent` (boot). |
| `NotifyUserSessionOpened()` | postMessage `OPEN_SESSION`. | `login.interceptor` tras login OK. |
| `NotifyUserSessionClosed()` | postMessage `CLOSE_SESSION`. | `LogoutGuard` al confirmar logout con múltiples pestañas. |
| `VerifyMutipleContexts()` | postMessage `VERIFY_MULTIPLE_CONTEXTS`. | interno de `ThereAreMultipleContexts()`. |
| `NotifyMultipleContextsVerified()` | postMessage `MULTIPLE_CONTEXT_VERIFIED`. | handler al recibir un VERIFY. |
| `ThereAreMultipleContexts()` | `race(respuesta, timer(250ms))` → `Observable<boolean>`. | `LogoutGuard`. |

### 1.4 Handlers de mensajes recibidos

- **`OPEN_SESSION`** (otra pestaña inició sesión, posible cambio de empresa):
  limpia `UserPermissions`, `CurrentFESession`, `SelectedCompany` → `navigate(['home'])`.
  → Fuerza a las demás pestañas a re-sincronizarse con la nueva sesión/empresa.
- **`CLOSE_SESSION`** (otra pestaña cerró sesión):
  `matDialog.closeAll()` → `IsLogoutFromBroadcastChannel = true` → `navigate(['login'])`.
  → La pestaña se desloguea **en silencio** (sin confirmación).
- **`VERIFY_MULTIPLE_CONTEXTS`**: responde con `MULTIPLE_CONTEXT_VERIFIED`.
- **`MULTIPLE_CONTEXT_VERIFIED`**: resuelve el `Subject` de la verificación en curso a `true`.

### 1.5 `LogoutService` — origen del logout (lo que el usuario llamó "el guard que valida quién emite")

Tres flags booleanos **mutuamente excluyentes** (al activar uno se apagan los otros):

| Flag | Significado |
|---|---|
| `IsLogoutFromMenu` | El usuario hizo click en *Cerrar sesión* del menú. |
| `IsLogoutFromBroadcastChannel` | El logout llegó desde otra pestaña (CLOSE_SESSION). |
| `IsFromLoadingInformationError` | Logout forzado por error al cargar información de usabilidad. |

### 1.6 `LogoutGuard` — árbol de decisión sobre `/login`

```
canActivate(/login):
  1. IsFromLoadingInformationError → closeAll; ALLOW (true)
  2. IsLogoutFromBroadcastChannel || !IsAuthenticated → closeAll; ALLOW (true)   // silencioso
  3. !IsLogoutFromMenu → navigate('/home'); BLOCK (false)                        // navegación directa a /login estando logueado
  4. IsLogoutFromMenu → ThereAreMultipleContexts():
       - multiple  → modal WARNING "Multiples pestañas abiertas" (Cancelar/Continuar)
                       continuar → NotifyUserSessionClosed() + closeAll → ALLOW (result)
       - single    → modal QUESTION "¿Está seguro que desea cerrar la sesión?" → ALLOW (result)
```

Al permitir la navegación, `AppComponent.ListenNavigationEvents()` detecta `NavigationEnd == '/login'`
y ejecuta `authentication.logout()` (limpieza real del storage).

### 1.7 Flujos completos

**A. Logout desde el menú (pestaña única):**
menú → `IsLogoutFromMenu=true` → `/login` → guard → autenticado + fromMenu → `ThereAreMultipleContexts()`=false
→ modal "¿Está seguro?" → confirma → ALLOW → `NavigationEnd /login` → `authentication.logout()` limpia storage.

**B. Logout desde el menú (múltiples pestañas):**
igual que A pero `ThereAreMultipleContexts()`=true → modal "Multiples pestañas abiertas"
→ confirma → `NotifyUserSessionClosed()` (avisa a las otras) → ALLOW → limpia storage.
Las **otras** pestañas reciben CLOSE_SESSION → se desloguean en silencio (flujo C).

**C. Logout recibido por broadcast (CLOSE_SESSION):**
handler → `closeAll` → `IsLogoutFromBroadcastChannel=true` → `/login` → guard regla 2 → ALLOW sin modal
→ `authentication.logout()` limpia storage.

**D. Login en una pestaña (OPEN_SESSION):**
login.interceptor → `NotifyUserSessionOpened()` → las otras pestañas reciben OPEN_SESSION
→ limpian permisos/FE/empresa → `navigate('home')` para re-sincronizar.

**E. Navegación directa a `/login` estando autenticado (sin pasar por menú):**
guard regla 3 → redirige a `/home` (bloquea quedar en login por accidente).

---

## 2. Diferencias arquitectónicas SPA (Angular) → MPA (Rails + Turbo + Stimulus)

| Aspecto | Angular SPA | Rails MPA |
|---|---|---|
| Boot global único | `AppComponent` constructor | No existe; cada página recarga JS. Hay que enganchar en **ambos** layouts. |
| Router guards | `canActivate` intercepta `/login` | No hay guard de ruta; la navegación es `window.location.href` (recarga completa). |
| Estado en memoria entre vistas | servicios singleton persisten | se pierde en cada navegación (cada acción maneja su propio flujo imperativamente). |
| Limpieza de storage | `authentication.logout()` al llegar a `/login` | ya la hace `menu_controller#logout` y `auth_guard#clearSession`. |
| Equivalente al guard | `LogoutGuard` | Distribuido: `login_controller.connect()` (regla 3), handlers imperativos (reglas 2 y 4). |

**Consecuencia clave:** la máquina de estado `LogoutService` **no necesita migrarse como tal**.
En MPA cada "origen" ejecuta su propio flujo completo de forma síncrona; los flags eran para
coordinar el guard del SPA. Lo que sí debe migrarse es el **canal** y la **lógica de
multiples-pestañas + confirmación**.

### Estado actual en Rails (ya implementado)

- `auth_guard_controller.js` — replica `VerifyUserTokenGuard` (checkAuth + clearSession).
- `login_controller.js` — `connect()` ya redirige a `/home` si hay sesión (≈ regla 3 del guard).
  En login OK hace `window.location.href = '/home'` pero **no notifica** a otras pestañas.
- `menu_controller.js` — `#logout()` confirma "¿Está seguro?" y limpia storage, pero
  **no detecta múltiples pestañas** ni **notifica** el cierre a las demás.
- **No existe** ningún `BroadcastChannel`. Esta es la funcionalidad ausente.

---

## 3. Diseño objetivo en Rails

### 3.1 Módulo singleton `session-sync` (equivale a `BroadcastChannelService`)

Nuevo: `app/javascript/vendor/clavisco/session-sync/index.js`

Exporta funciones imperativas (no es Stimulus, para poder llamarse desde varios controllers):

```js
export function initSessionSync()           // crea el canal + onmessage + GUID (idempotente)
export function notifySessionOpened()        // postMessage OPEN_SESSION
export function notifySessionClosed()        // postMessage CLOSE_SESSION
export function thereAreMultipleContexts()   // Promise<boolean> con timeout 250ms
```

Detalles:
- Canal `'fe-app-channel'` (mismo nombre que legacy, por compatibilidad si conviven).
- `CONTEXT_GUID = crypto.randomUUID()` por carga de página (suficiente en MPA: el verificador
  permanece vivo durante los 250 ms antes de redirigir).
- Handler de mensajes recibidos:
  - `OPEN_SESSION` → `sessionStorage.removeItem('Permissions'|'currentFEUser'|'CurrentCompany')` → `location.href='/home'`.
  - `CLOSE_SESSION` → limpiar storage (reusar el set de `auth_guard#clearSession`) → `location.href='/login'` (silencioso).
  - `VERIFY_MULTIPLE_CONTEXTS` → responde `MULTIPLE_CONTEXT_VERIFIED`.
  - `MULTIPLE_CONTEXT_VERIFIED` → resuelve la promesa de verificación en curso.
- Ignorar mensajes con el propio `guid`.

### 3.2 Stimulus controller `session_sync_controller.js` (equivale a `RegisterContext` en `AppComponent`)

Thin controller que solo llama `initSessionSync()` en `connect()`.
Se monta en **ambos** layouts para que el listener siempre esté vivo:
- `app/views/layouts/protected.html.erb` (en el `data-controller="auth-guard menu company-selector"` → agregar `session-sync`).
- `app/views/layouts/application.html.erb` (página de login).

Registrar en `app/javascript/controllers/index.js`:
```js
import SessionSyncController from 'controllers/session_sync_controller'
application.register('session-sync', SessionSyncController)
```

### 3.3 Integración en controllers existentes

- **`login_controller.js`**: tras login OK, antes de `window.location.href='/home'`,
  llamar `notifySessionOpened()`.
- **`menu_controller.js` `#logout()`**: reemplazar el `confirm` simple por:
  1. `const multiple = await thereAreMultipleContexts()`
  2. modal según corresponda:
     - multiple → `confirm('Se han detectado múltiples pestañas... se cerrará la sesión en las demás.', 'Multiples pestañas abiertas')` (warning)
     - single → `confirm('¿Está seguro que desea cerrar sesión?', 'Cerrar sesión')`
  3. si confirma y `multiple` → `notifySessionClosed()`
  4. limpiar storage + `window.location.href='/login'`.

### 3.4 Mapa de equivalencias

| Legacy | Rails |
|---|---|
| `BroadcastChannelService` | módulo `vendor/clavisco/session-sync` |
| `AppComponent.RegisterContext()` | `session_sync_controller#connect()` en ambos layouts |
| `login.interceptor` → `NotifyUserSessionOpened()` | `login_controller` tras login OK → `notifySessionOpened()` |
| `LogoutGuard` regla 4 (modal + multiples) | `menu_controller#logout()` |
| `LogoutGuard` regla 3 (directo→home) | `login_controller#connect()` (ya existe) |
| `LogoutGuard` regla 2 (broadcast silencioso) | handler `CLOSE_SESSION` del módulo |
| `LogoutService` flags | **no se migra** (innecesario en MPA) |

---

## 4. Plan de ejecución por fases

**Fase 1 — Módulo de canal.** Crear `vendor/clavisco/session-sync/index.js` con las 4 funciones
y el handler. Constantes de tipos de mensaje en el mismo archivo.

**Fase 2 — Controller + registro.** Crear `session_sync_controller.js`, registrarlo en `index.js`,
añadir `session-sync` al `data-controller` de `protected.html.erb` y montar en `application.html.erb`.

**Fase 3 — Login.** Inyectar `notifySessionOpened()` en `login_controller` tras login OK.

**Fase 4 — Logout.** Reescribir `menu_controller#logout()` con detección de múltiples pestañas,
modal diferenciado y `notifySessionClosed()`. Centralizar el set de claves de storage para no
duplicarlo entre `menu_controller`, `auth_guard` y el handler `CLOSE_SESSION`.

**Fase 5 — Pruebas E2E (Playwright, obligatorio por protocolo).** Suite
`fec-ui-migration/tests/e2e/session-sync-suite.spec.js` usando **dos `page` / contextos** para
simular pestañas:
- Login en pestaña B → pestaña A (en página protegida) navega a `/home` y pierde empresa/permisos.
- Logout en B con 2 pestañas → modal "Multiples pestañas abiertas"; al confirmar, A va a `/login`.
- Logout con 1 pestaña → modal "¿Está seguro?".
- CLOSE_SESSION recibido → la pestaña receptora limpia storage y va a `/login` sin modal.
- Navegación directa a `/login` autenticado → redirige a `/home`.

**Fase 6 — Documentación final.** `fec-migration-docs/progress/BROADCAST-CHANNEL-MIGRATION-COMPLETE.md`
+ commit.

---

## 5. Riesgos y edge cases

- **GUID por recarga (MPA):** válido porque el verificador espera los 250 ms en la misma página
  antes de redirigir. Si en el futuro se mueve a un flujo asíncrono que navegue antes, revisar.
- **`localStorage` vs `sessionStorage`:** `Session` es `localStorage` (compartido entre pestañas);
  `CurrentCompany`/`Permissions`/`currentFEUser` son `sessionStorage` (por pestaña). El handler
  `OPEN_SESSION` debe limpiar **solo** los de `sessionStorage` y redirigir a `/home` para re-sync.
- **Bucle de mensajes:** evitar que el handler `CLOSE_SESSION` reemita `CLOSE_SESSION`. Solo notifica
  quien origina el logout (menú), nunca el receptor.
- **Evento nativo `storage`:** alternativa más simple, pero el legacy usa `BroadcastChannel`
  explícitamente; se replica `BroadcastChannel` para fidelidad y para los mensajes de verificación.
- **Timeout 250 ms:** mantener el mismo valor del legacy para no cambiar la UX percibida.
- **Cierre de modales (`matDialog.closeAll`):** en Rails equivale a cerrar paneles/modales abiertos
  antes de redirigir; revisar si hay paneles laterales abiertos al recibir CLOSE_SESSION.

---

## 6. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails (actual) | Plan |
|---|---|---|
| Canal de comunicación entre pestañas | ❌ | Fase 1 |
| Notificar apertura de sesión (OPEN_SESSION) | ❌ | Fase 3 |
| Re-sync de pestañas al abrir sesión | ❌ | Fase 1 (handler) |
| Notificar cierre de sesión (CLOSE_SESSION) | ❌ | Fase 4 |
| Cierre silencioso al recibir CLOSE_SESSION | ❌ | Fase 1 (handler) |
| Detección de múltiples pestañas + modal | ❌ | Fase 4 |
| Modal "¿Está seguro?" (pestaña única) | ✅ (parcial) | Fase 4 (ajuste) |
| Redirigir a /home si entra directo a /login autenticado | ✅ | — (ya existe) |
| Limpieza de storage en logout | ✅ | Fase 4 (centralizar) |
| Máquina de estado de origen (`LogoutService`) | N/A | No se migra (innecesario en MPA) |
