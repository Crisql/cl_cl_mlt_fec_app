# LOGIN — Análisis Completo de Migración Angular → Rails

**Módulo:** Login  
**URL Rails:** `/login`  
**Fecha:** 2026-06-03

---

## Archivos Angular

| Archivo | Ruta |
|---|---|
| Componente TS | `legacy/web_angular/src/app/pages/login/login.component.ts` |
| Template HTML | `legacy/web_angular/src/app/pages/login/login.component.html` |
| Estilos SCSS | `legacy/web_angular/src/app/pages/login/login.component.scss` |
| Módulo | `legacy/web_angular/src/app/pages/login/login.module.ts` |
| Auth Guard | `legacy/web_angular/src/app/core/guards/auth.guard.ts` |
| Logout Guard | `legacy/web_angular/src/app/core/guards/logout.guard.ts` |
| Storage Service | `legacy/web_angular/src/app/core/services/storage.service.ts` |

---

## Estructura de la Página

El componente Angular es un **wrapper delgado** que delega toda la UI al componente vendor `<cl-login>`.  
No hay tabs, modales ni secciones adicionales — es una página de login estándar.

---

## Campos

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Email / Username | text/email | Sí | Usado como `username` en OAuth |
| Password | password | Sí | — |
| reCAPTCHA | widget | Sí (`useRecaptcha: true`) | Validado antes de submit |

---

## Botones

| Botón | Acción | Estado deshabilitado |
|---|---|---|
| Ingresar / Login | Submit del formulario → POST `/api/token` | Mientras hay request en vuelo o reCAPTCHA inválido |

---

## Configuración del componente `<cl-login>` (Angular)

```typescript
Id: string = 'LoginId'
ShouldResolve: boolean = true          // Muestra overlay mientras resuelve
ApiUrl: string = environment.ApiAppUrl + 'api/'  // http://localhost:50039/api/
PathToRedirect: string = 'home'        // Ruta destino post-login
LogoPath: string = '/assets/Logo-Clavisco-blue.svg'
DotNetApiType: 'CORE' = 'CORE'
SessionName: string = 'currentUser'   // Clave localStorage Angular
EnforcePasswordPolicy: boolean = false
UseReCaptcha: boolean = true
```

> **Nota:** La clave de localStorage en Angular es `"currentUser"`. El vendor Rails migrado (`vendor/clavisco/login/index.js`) usa `"Session"` como clave deliberada de la migración.

---

## Flujos de Usuario

### Flujo: Login exitoso
1. Usuario abre `/login`
2. Si ya tiene sesión válida → redirect a `/home`
3. Ingresa email + password
4. Completa reCAPTCHA (si habilitado)
5. Click en "Ingresar"
6. POST `/api/token` con `grant_type=password`
7. Guarda token en `localStorage['Session']`
8. GET `/api/Users/GetUserInfo` → guarda en `localStorage['UserInfo']`
9. GET `/api/Companies` → guarda en `localStorage['Companies']`
10. Redirect a `/home`

### Flujo: Login fallido
1. API retorna error (credenciales inválidas, cuenta bloqueada, etc.)
2. Muestra mensaje de error (toast/alert)
3. Limpia password, mantiene email
4. reCAPTCHA se resetea

### Flujo: Logout guard
- Si usuario autenticado navega a `/login` sin logout explícito → redirect a `/home`
- Si viene de logout de menú → muestra confirmación
- Si hay múltiples pestañas → muestra advertencia de cierre múltiple

---

## Llamadas API

| Método | Endpoint | Headers | Body | Propósito |
|---|---|---|---|---|
| POST | `/api/token` | `Content-Type: application/x-www-form-urlencoded` | `grant_type=password&username=&password=` | Obtener token OAuth2 |
| GET | `/api/Users/GetUserInfo` | `Authorization: Bearer {token}` | — | Info del usuario |
| GET | `/api/Companies` | `Authorization: Bearer {token}` | — | Empresas disponibles |

---

## Lógica de Negocio

- **Auth guard:** Todas las rutas protegidas redirigen a `/login` si no hay sesión
- **Logout guard:** La ruta `/login` redirige a `/home` si ya hay sesión activa
- **Token expiration:** Se valida `expires_at` en cada verificación de auth
- **reCAPTCHA:** Configurado como obligatorio (`useRecaptcha: true`)
- **ShouldResolve:** Muestra overlay de carga durante el proceso de autenticación

---

## Componentes Vendor Usados

| Vendor Angular | Equivalente Rails |
|---|---|
| `@clavisco/login` (cl-login) | `app/javascript/vendor/clavisco/login/index.js` (AuthService) |
| `@clavisco/core` (Storage, etc.) | `app/javascript/vendor/clavisco/core/index.js` |
| `@clavisco/alerts` | `app/javascript/vendor/clavisco/alerts/` |
| `@clavisco/overlay` | `app/javascript/vendor/clavisco/overlay/` |

---

## Matriz de Funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Vista de login (HTML/ERB) | ✅ | 100% | |
| Stimulus controller | ✅ | 100% | |
| Auth service (vendor) | ✅ | 100% | Ya existía |
| POST /api/token | ✅ | 100% | Vía auth service |
| Redirect post-login a /home | ✅ | 100% | |
| Guard: autenticado → /home | ✅ | 100% | En Stimulus |
| Manejo de errores / toast | ✅ | 100% | |
| Logo Clavisco | ✅ | 100% | |
| Loading overlay | ✅ | 100% | |
| reCAPTCHA | ⚠️ | 0% | No implementado en vendor Rails; `useRecaptcha=true` en Angular pero no hay clave de sitio en env |

---

## Diferencias Conocidas vs Angular

1. **Clave localStorage:** Angular usa `"currentUser"`, Rails usa `"Session"` (decisión de la migración del vendor).
2. **reCAPTCHA:** Angular lo tenía habilitado pero Rails no tiene integración de reCAPTCHA implementada en el vendor. Se omite en esta versión.
3. **Múltiples pestañas warning:** El LogoutGuard de Angular detecta múltiples contextos vía BroadcastChannel. En Rails se implementa lógica client-side equivalente simplificada.
