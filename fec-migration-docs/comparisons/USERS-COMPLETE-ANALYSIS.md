# USERS — Análisis Completo de Migración

## URL
`http://localhost:3000/configurations/users`

## Estructura Angular Legacy

| Componente Angular | Ruta | Descripción |
|---|---|---|
| `UsersComponent` | `/configurations/users` | Shell con tabs + router-outlet |
| `UsersListComponent` | `/configurations/users/list` | Tab 0 — Lista de usuarios |
| `CompleteUsersRegistrationComponent` | `/configurations/users/complete-registration` | Tab 1 — Activar usuarios inactivos |
| `UserAssignmentComponent` | `/configurations/users/assignment` | Tab 2 — Asignar compañías a usuarios |
| `RegisterUsersComponent` | `/configurations/users/register` | Página separada — Crear usuario |
| `EditUserComponent` | `/configurations/users/update?userId=...` | Página separada — Editar usuario |

---

## TAB 0 — Lista de Usuarios

### Permisos requeridos
- Ver tab: `Configurations_Users_ListAccess`
- Crear usuario: `S_RegUser` (botón Crear)
- Editar usuario: `Configurations_Users_Update` (botón por fila)

### Campos de búsqueda
| Campo | Tipo | Placeholder |
|---|---|---|
| FullName | text | "Nombre Completo" |
| Email | text | "Correo Electrónico" |

### API
- `GET /api/User/accessible?fullName=&email=&activeOnly=false`
- El backend filtra automáticamente según permisos del usuario:
  - `Configurations_Users_ViewAllApplicationUsers` → todos los usuarios de la app
  - `Configurations_Users_ViewGroupUsers` → usuarios del grupo
  - Sin ninguno → solo usuarios de la compañía actual

### Columnas Tabulator
| Columna Angular | Field | Notas |
|---|---|---|
| Nombre Completo | FullName | |
| Correo Electrónico | Email | |
| Identificación | Identification | |
| Usuario SAP | SapUser | |
| Fecha de Creación | CreateDate | formato `yyyy-MM-dd HH:mm:ss` |
| Email Confirmado | EmailConfirmed | Badge: Sí/No |
| Activo | Active | Badge: Activo/Inactivo |
| Acciones | _actions | Botón Editar (solo si tiene perm) |

### Botones por fila
- **Editar** → navega a `/configurations/users/edit?userId={id}`

### Botones de toolbar
- **Consultar** → recarga con filtros
- **Crear** (condicional perm S_RegUser) → navega a `/configurations/users/register`

---

## TAB 1 — Completar Registro

### Permisos requeridos
- `S_CompUser`

### API
- `GET /api/User/GetInactiveUsers?companyId={id}` → lista usuarios inactivos

### Columnas Tabulator
| Campo | Notas |
|---|---|
| Identification | Identificación |
| FullName | Nombre |
| Email | Correo |
| EmailConfirmed | Badge: Sí/No |
| Active | Badge: Activo/Inactivo |
| Acciones | 2 botones por fila |

### Botones por fila
- **Activar Usuario** → `PATCH /api/User/activate?userId={id}`
- **Reenviar Correo Confirmación** → `POST /api/User/email-confirmations?userId={id}`

---

## TAB 2 — Asignación de compañías

### Permisos requeridos
- `S_AsigUser`

### APIs de carga inicial
- `GET /api/User/for-assignments` → lista de usuarios (Id, Email)
- `GET /api/Group/for-assignments` → lista de grupos (prepend opción "Todos" con Id=-1)
- `GET /api/Companies/for-assignment?groupId=-1` → todas las compañías

### Flujo de usuario
1. Autocompletar usuario → filtra por Email
2. Al seleccionar usuario: `GET /api/User/assigned-companies?userId={id}`
   - Divide `allCompanies` en `assignedCompanies` + `unassignedCompanies`
3. Opcional: filtrar por grupo → `GET /api/Companies/for-assignment?groupId={id}` → recarga listas
4. Transferir compañías (click-to-move o botones "Asignar todas" / "Desasignar todas")
5. **Aplicar Cambios**:
   - Si `toAssign.length > 0`: `POST /api/User/bulk-assign-companies { User: email, CompanyIds: [...] }`
   - Si `toUnassign.length > 0`: `POST /api/User/bulk-unassign-companies { User: email, CompanyIds: [...] }`

### Tracking de cambios
- `initialAssignedIds`: Set de IDs al cargar el usuario
- `currentAssignedIds`: Set actualizado en tiempo real
- `toAssign = currentAssignedIds - initialAssignedIds`
- `toUnassign = initialAssignedIds - currentAssignedIds`

---

## Página — Registrar Usuario

### Permisos
- Acceso desde botón "Crear" en Tab Lista (perm `S_RegUser`)

### Campos
| Campo | Tipo | Validación |
|---|---|---|
| Compañía | select | requerido |
| Cuenta (Grupo) | select | requerido |
| Nombre Completo | text | requerido |
| Cédula | text | requerido, solo números |
| Usuario (email) | text | requerido, formato email |
| Tipo de OC | select | requerido solo si companyId ∈ {186, 1206} |

### Carga inicial
- `GET /api/Companies/GetCompaniesByUserGroup?companyId={id}` → poblar select Compañía
- `GET /api/Group/GetGroupsByUser?companyId={id}` → poblar select Grupo

### Submit
- `POST /api/User` con payload:
  ```json
  {
    "Id": "",
    "CompanyIdDB": 1,
    "GroupIdDB": 1,
    "FullName": "...",
    "Identification": "...",
    "UserName": "email@...",
    "Email": "email@...",
    "EmailConfirmed": false,
    "Owner": false,
    "CreateDate": "ISO string",
    "Active": false,
    "PasswordHash": "",
    "SapUser": "",
    "SapPass": "",
    "DocNumberPreference": "1" | "2" | ""
  }
  ```
- Éxito → navega a `/configurations/users`

---

## Página — Editar Usuario

### URL
`/configurations/users/edit?userId={id}`

### Carga inicial
- `GET /api/User/information?userId={id}` → datos del usuario
- `GET /api/User/companies?userId={id}` → compañías disponibles para probar credenciales

### Campos
| Campo | Notas |
|---|---|
| Nombre Completo | requerido |
| Identificación | requerido, solo números |
| Usuario SAP | requerido |
| Contraseña SAP | opcional (toggle visibility) |
| Compañía para probar credenciales | select, habilitado solo si se edita SAP user/pass |
| Activo | checkbox |

### Lógica "Probar credenciales"
- Al editar SapUser o SapPass: `credentialsDirty = true`, `credentialsValidated = false`
- Botón "Probar" habilitado solo si `credentialsDirty && selectedCompanyId`
- Al probar: `POST /api/SapConnections/validate-credentials { SapUser, SapPass, CompanyId }`
- Botón "Actualizar" bloqueado si `credentialsDirty && !credentialsValidated`

### Submit
- `PATCH /api/User` con todos los campos del usuario
- Éxito → navega a `/configurations/users`

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % |
|---|---|---|
| Tab navigation con permisos | ✅ | 100% |
| Tab Lista — tabla Tabulator | ✅ | 100% |
| Tab Lista — filtros búsqueda | ✅ | 100% |
| Tab Lista — botón Crear (condicional) | ✅ | 100% |
| Tab Lista — botón Editar por fila | ✅ | 100% |
| Tab Lista — badges Active/EmailConfirmed | ✅ | 100% |
| Tab Completar Registro — tabla | ✅ | 100% |
| Tab Completar Registro — activar usuario | ✅ | 100% |
| Tab Completar Registro — reenviar email | ✅ | 100% |
| Tab Asignación — autocomplete usuario | ✅ | 100% |
| Tab Asignación — autocomplete grupo | ✅ | 100% |
| Tab Asignación — dual list click-to-move | ✅ | 100% |
| Tab Asignación — asignar/desasignar todas | ✅ | 100% |
| Tab Asignación — tracking de cambios | ✅ | 100% |
| Tab Asignación — bulk assign/unassign | ✅ | 100% |
| Página Registrar — formulario completo | ✅ | 100% |
| Página Registrar — toggle Tipo OC | ✅ | 100% |
| Página Registrar — validación | ✅ | 100% |
| Página Registrar — POST /api/User | ✅ | 100% |
| Página Editar — pre-fill formulario | ✅ | 100% |
| Página Editar — toggle contraseña | ✅ | 100% |
| Página Editar — probar credenciales SAP | ✅ | 100% |
| Página Editar — PATCH /api/User | ✅ | 100% |

### Diferencias conocidas con Angular
- **Dual list**: Angular usa `@angular/cdk/drag-drop`. Rails usa click-to-move (igual funcionalidad, UX distinto).
- **Tabla Lista**: Angular usa `@clavisco/table`. Rails usa Tabulator (igual funcionalidad).
