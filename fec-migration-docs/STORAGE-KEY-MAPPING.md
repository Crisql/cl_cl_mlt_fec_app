# Storage Key Mapping — Angular Legacy → Rails Migration

## Decisión de diseño

| Storage | Propósito |
|---|---|
| `localStorage` | Datos persistentes entre pestañas y sesiones (auth token, preferencias globales) |
| `sessionStorage` | Datos por pestaña — permite múltiples pestañas con empresas distintas |

---

## Tabla de mapeo

| Key | Storage | Angular legacy | Rails (este proyecto) | Notas |
|---|---|---|---|---|
| **Token de sesión** | `localStorage` | `currentUser` | `Session` | Renombrado. Estructura diferente (ver abajo) |
| **Token FE Sync** | `sessionStorage` | `currentFEUser` | `currentFEUser` | Igual. Token del servidor Sync/FE (ApiFEUrl) |
| **Empresa seleccionada** | `sessionStorage` | `SelectedCompany` | `CurrentCompany` | Renombrado. Mismo contenido |
| **Permisos del usuario** | `sessionStorage` | En memoria (`PermsService`) | `Permissions` | Nuevo: se persiste en sessionStorage |
| **Banner por usuario** | `localStorage` | `BannerUser` | `BannerUser` | Igual |
| **Estado del menú** | `localStorage` | No existía | `menuState` | Nuevo |

---

## Estructura de cada key

### `localStorage.Session` (antes: `localStorage.currentUser`)
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_at": 1780567134000,
  ".expires": "4/6/2026 09:58:54",
  "UserEmail": "user@clavisco.com",
  "UserId": "abc123=="
}
```
> Angular guardaba el objeto `Token` completo (`UserName`, `userId`, `companyId`, `ExpireTime`, etc.).
> Rails guarda solo los campos necesarios para autenticación.

### `sessionStorage.currentFEUser` (igual que Angular legacy)
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "ExpireTime": "2026-06-09T10:00:00"
}
```
> Token del servidor FE Sync (`api_fe_sync_url`). Se obtiene haciendo POST `/token` al sync server
> con las credenciales de `api/Credentials/GetFeCredentials?companyId={id}`.
> Se renueva en cada cambio de empresa (`company_selector_controller.js`).
> Se usa como `Authorization: Bearer {access_token}` en todos los requests con `API: ApiFEUrl`.

### `sessionStorage.CurrentCompany` (antes: `sessionStorage.SelectedCompany`)
```json
{
  "companyName": "Empresa Demo",
  "companyId": 123,
  "codigoActividad": "462001",
  "groupId": 1,
  "UseFactProv": false,
  "SendReceptAndApInv": false
}
```
> Mismo contenido, distinto nombre de key.

### `sessionStorage.Permissions`
```json
["M_Documents", "Documents_Issued_ViewDocuments", "M_Config", "S_Company"]
```
> En Angular era in-memory (`PermsService.USER_PERMISSIONS: Set<string>`).
> En Rails se persiste en sessionStorage para sobrevivir navegación entre páginas dentro de la misma pestaña.

---

## Helpers disponibles

```javascript
// localStorage — vendor/clavisco/core
import { Storage } from 'vendor/clavisco/core'
Storage.get('Session')      // leer
Storage.set('Session', obj) // escribir

// sessionStorage — vendor/clavisco/core
import { SStore } from 'vendor/clavisco/core'
SStore.get('CurrentCompany')       // leer empresa
SStore.set('CurrentCompany', obj)  // escribir empresa
SStore.get('Permissions')          // leer permisos
SStore.set('Permissions', arr)     // escribir permisos
```

---

## Archivos que leen/escriben cada key

| Key | Lee | Escribe |
|---|---|---|
| `localStorage.Session` | `auth_guard_controller.js`, `menu_controller.js`, `vendor/login` | `vendor/clavisco/login/index.js` |
| `sessionStorage.CurrentCompany` | `menu_controller.js`, `company_selector_controller.js`, `home_controller.js`, `vendor/clavisco/core` (getApiHeaders) | `company_selector_controller.js`, `vendor/clavisco/login/index.js` |
| `sessionStorage.Permissions` | `menu_controller.js` | `menu_controller.js`, `company_selector_controller.js` |
| `localStorage.BannerUser` | `home_controller.js` | `home_controller.js` |
| `localStorage.menuState` | `menu_controller.js` | `menu_controller.js` |
