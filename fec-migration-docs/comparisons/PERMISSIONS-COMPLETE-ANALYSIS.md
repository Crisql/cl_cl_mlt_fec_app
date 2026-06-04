# PERMISSIONS — Análisis Completo de Migración Angular → Rails

## Ubicación Angular
`legacy/web_angular/src/app/pages/configuration/perms/`

## Estructura de la Página

### Contenedor principal (`PermissionsComponent`)
- **2 tabs** filtrados por permisos del usuario:
  | Tab | Label | Route | Permiso requerido |
  |-----|-------|-------|-------------------|
  | 0 | Permisos por Rol | `by-role` | `Configurations_Permissions_Access` |
  | 1 | Permisos Globales | `global` | `Configurations_Permissions_GlobalAccess` |
- Si el usuario no tiene ningún permiso → redirect a `/home`
- Auto-redirect a primer tab disponible si URL es la base
- URL refleja el tab activo: `/configurations/permissions/by-role` o `/configurations/permissions/global`
- Al cambiar tab → actualiza URL via `history.replaceState`

---

## Tab 1: Permisos por Rol (`PermsByRolComponent`)

### Campos
| Campo | Tipo | Default | Validación |
|-------|------|---------|------------|
| Role (selector) | `<select>` | `4` (id fijo) | required |

### Botones
| Botón | Acción | Habilitado cuando |
|-------|--------|-------------------|
| Chevron Right (header "Disponibles") | `AddAllPerms()` | `unassignedPerms.length > 0` |
| Chevron Left (header "Asignados") | `RemoveAllPerms()` | `assignedPerms.length > 0` |
| Cancelar Cambios | `CancelChanges()` → `GetPermsByRol()` | `hasChanges === true` |
| Guardar Cambios | `SaveChange()` | `hasChanges === true` |

### Drag & Drop
- Lista "Permisos Disponibles" (`unassignedPerms`) ↔ Lista "Permisos Asignados" (`assignedPerms`)
- Drag dentro de la misma lista → reordenar
- Drag entre listas → asignar/desasignar
- Cada item muestra: `perm.Description` + `#perm.Id`
- Empty states:
  - Disponibles vacío: icono `check_circle` + "Todos los permisos están asignados"
  - Asignados vacío: icono `inbox` + "No hay permisos asignados"

### Badge "Cambios pendientes"
- Visible cuando hay `idRol` seleccionado
- Valor: `permIdsToAssign.length + permIdsToUnassign.length`
- Color naranja cuando `hasChanges === true`

### Resumen de cambios (`changes-summary`)
- Visible solo cuando `hasChanges === true`
- Muestra cuántos permisos se van a asignar (verde) y cuántos desasignar (rojo)

### Lógica de negocio
1. Al cargar: `GetRoles(companyId)` + `GetPerms()`
2. Al cambiar empresa (header): recarga toda la vista
3. `GetRoles` filtra roles con `Name.toUpperCase() !== 'OWNER'`
4. Al obtener roles: auto-selecciona el primer rol (default 4) y llama `GetPermsByRol()`
5. `GetPermsByRol()` separa `allPermsList` en `assignedPerms` y `unassignedPerms` según `permsByRolList`
6. `CalculateChanges()`: diff entre `initialAssignedIds` (estado BD) y `currentAssignedIds` (estado UI)
7. `SaveChange()`:
   - Construye `permByRolList` con todos los `assignedPerms` actuales
   - POST a `AssignPermByRol`
   - Tras éxito: actualiza `initialAssignedIds`, limpia cambios
   - Llama `GetPermsByUser` → actualiza localStorage → `window.location.reload()`

### APIs
| Método | Endpoint | Headers | Params |
|--------|----------|---------|--------|
| GET | `/api/Rol/GetRoles` | `API: ApiAppUrl` | `?companyId=X` |
| GET | `/api/Permission/GetPermissions` | `API: ApiAppUrl` | — |
| GET | `/api/Permission/GetPermissionsByRol` | `API: ApiAppUrl` | `?idRol=X` |
| POST | `/api/Permission/AssignPermByRol` | `API: ApiAppUrl` | body: `{ permByRolList, idRol }` |
| GET | `/api/Permission/GetPermsByUser` | `API: ApiAppUrl` | `?companyId=X` |

---

## Tab 2: Permisos Globales (`GlobalPermsComponent`)

### Campos
| Campo | Tipo | Default | Comportamiento |
|-------|------|---------|----------------|
| User (autocomplete) | text input | `''` | Filtra por email al escribir |

### Botones
| Botón | Acción | Habilitado cuando |
|-------|--------|-------------------|
| Chevron Right (header "Disponibles") | `AssignAllPerms()` | `unassignedPerms.length > 0` |
| Chevron Left (header "Asignados") | `UnassignAllPerms()` | `assignedPerms.length > 0` |
| Cancelar Cambios | `CancelChanges()` | `hasChanges === true` |
| Aplicar Cambios | `ApplyChanges()` | `hasChanges === true` |

### Autocomplete de usuario
- Input con `matAutocomplete` → filtra `usersList` por `user.Email`
- Al seleccionar usuario → llama `getGlobalUserPermissions(user.Id)`
- Display: `user.Email`
- Al limpiar el campo → `ClearAssignments()`

### Drag & Drop
- Idéntico al tab "Permisos por Rol"
- Empty states:
  - Disponibles vacío: "Todos los permisos están asignados"
  - Asignados vacío: "No hay permisos asignados"
- Panel de listas visible solo cuando hay `selectedUserId`
- Sin usuario: mensaje con icono `person_search` + "Selecciona un usuario"

### Lógica de negocio
1. Al cargar: `forkJoin([getAccessibleUsers(activeOnly=true), getGlobalPermissions()])`
2. `getAccessibleUsers` filtra `Active === true`
3. Al seleccionar usuario: `getGlobalUserPermissions(userId)` → carga sus permisos globales actuales
4. `CalculateChanges()`: diff entre `initialAssignedIds` y `currentAssignedIds`
5. `ApplyChanges()`:
   - Si `permIdsToAssign.length > 0` → POST `bulk-global-permissions`
   - Si `permIdsToUnassign.length > 0` → DELETE `bulk-global-permissions`
   - Usa `forkJoin` para ejecutar en paralelo
   - Tras éxito: actualiza `initialAssignedIds`, limpia cambios (NO recarga página)
6. `CancelChanges()`: si hay usuario → recarga sus permisos; si no → `ClearAssignments()`
7. Al cambiar empresa: recarga toda la vista

### APIs
| Método | Endpoint | Headers | Params/Body |
|--------|----------|---------|-------------|
| GET | `/api/User/accessible` | — | `?activeOnly=true` |
| GET | `/api/Permission/global-permissions` | — | — |
| GET | `/api/User/global-permissions` | — | `?userId=X` |
| POST | `/api/Permission/bulk-global-permissions` | — | `{ UserId, PermissionIds[] }` |
| DELETE | `/api/Permission/bulk-global-permissions` | — | body: `{ UserId, PermissionIds[] }` |

---

## Matriz de Funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---------------|----------------------|------------|-------|
| Contenedor con tabs | ❌ | 0% | |
| Filtro de tabs por permisos | ❌ | 0% | |
| Auto-redirect primer tab | ❌ | 0% | |
| URL refleja tab activo | ❌ | 0% | |
| Tab By-Role: selector de rol | ❌ | 0% | |
| Tab By-Role: drag & drop | ❌ | 0% | |
| Tab By-Role: asignar/desasignar todos | ❌ | 0% | |
| Tab By-Role: badge cambios pendientes | ❌ | 0% | |
| Tab By-Role: resumen cambios | ❌ | 0% | |
| Tab By-Role: guardar / cancelar | ❌ | 0% | |
| Tab By-Role: reload permisos usuario | ❌ | 0% | |
| Tab Global: autocomplete usuario | ❌ | 0% | |
| Tab Global: drag & drop global perms | ❌ | 0% | |
| Tab Global: asignar/desasignar todos | ❌ | 0% | |
| Tab Global: badge cambios pendientes | ❌ | 0% | |
| Tab Global: resumen cambios | ❌ | 0% | |
| Tab Global: aplicar / cancelar | ❌ | 0% | |
| Rutas Rails | ❌ | 0% | |
