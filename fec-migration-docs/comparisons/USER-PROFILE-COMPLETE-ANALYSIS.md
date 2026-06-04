# USER-PROFILE — Análisis Completo de Migración

**URL:** `http://localhost:3000/configurations/user-profile`  
**Componente Angular:** `pages/configuration/users/update-user-info/update-user-info.component`  
**Título de página:** "Actualización de la Información del Usuario"

---

## Estructura de la Página

Formulario de una sola sección (sin tabs) con un layout de dos columnas (responsive). Contiene:
- Campo: Usuario de SAP
- Campo: Contraseña de SAP (con toggle visibilidad)
- Campo: Compañía para probar credenciales (select)
- Campo: Tipo de OC (select, **condicional**)
- Botón: Probar credenciales
- Botón: Actualizar

---

## Campos

| Campo | Tipo | Validación | Default | Notas |
|---|---|---|---|---|
| `SapUser` | text input | required | cargado de `GetUserInfo` | Nombre de usuario SAP del usuario |
| `SapPass` | password input | ninguna (en formGroup) | vacío | Toggle show/hide con icono `visibility`/`visibility_off` |
| `selectedCompanyId` | select (ngModel standalone) | ninguna | `SelectedCompany.companyId` del storage | Deshabilitado hasta que `credentialsDirty = true` |
| `OCTypeControl` | select | ninguna (condicional) | `userInfo.DocNumberPreference` si matchea OCType | **Solo visible** si `companyId` ∈ {186, 1206} |

### OCTypes (constante)
```
[{Id: 1, Value: 'Con numero de OC'}, {Id: 2, Value: 'Sin numero de OC'}]
```

### CompanyWhitOC (enum — para visibilidad de OCTypeControl)
```
CentroComunidadProd = 186
CentroComunidadTest = 1206
```

---

## Botones

| Botón | Estado habilitado | Comportamiento |
|---|---|---|
| **Probar credenciales** | `credentialsDirty && selectedCompanyId && !isValidating` | POST `api/Connections/validate-user-credentials` |
| **Actualizar** | `!form.invalid && !(credentialsDirty && !credentialsValidated)` | PATCH `api/User/profile-info` |

### Estados del botón "Probar credenciales"
- Default: icono `wifi_tethering` + texto "Probar credenciales"
- Validando: icono `hourglass_empty` + texto "Probando..." 
- Verificado: icono `check_circle` + texto "Credenciales verificadas" + fondo verde + animación burst

---

## Event Listeners

| Evento | Campo/Botón | Acción |
|---|---|---|
| `valueChanges` | `SapUser` | `credentialsDirty = true`, `credentialsValidated = false` |
| `valueChanges` | `SapPass` | `credentialsDirty = true`, `credentialsValidated = false` |
| `ngModelChange` | `selectedCompanyId` | `credentialsValidated = false` |
| `click` | Probar credenciales | `TestCredentials()` |
| `click` | Actualizar | `OnSubmitUpdateUserInfo(form)` |
| `click` | Toggle password | `hide = !hide` |

---

## Llamadas API

| Método | Endpoint | Cuándo | Headers especiales |
|---|---|---|---|
| GET | `api/User/GetUserInfo` | On load (forkJoin) | `API: ApiAppUrl` |
| GET | `api/Group/GetGroupsByUser?companyId={id}` | On load (forkJoin) | `API: ApiAppUrl` |
| GET | `api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active` | On load (paralelo) | ninguno extra |
| POST | `api/Connections/validate-user-credentials` | Al hacer click "Probar credenciales" | ninguno extra |
| PATCH | `api/User/profile-info` | Al hacer click "Actualizar" | ninguno extra |

### Payload PATCH `api/User/profile-info`
```json
{
  "Id": "...",
  "Identification": "...",
  "FullName": "...",
  "Email": "...",
  "EmailConfirmed": true,
  "UserName": "...",
  "PasswordHash": "...",
  "Active": true,
  "CreateDate": "...",
  "Owner": false,
  "SapUser": "...",
  "SapPass": "...",
  "DocNumberPreference": "1"   // toString() del valor numérico
}
```

### Payload POST `api/Connections/validate-user-credentials`
```json
{
  "SapUser": "...",
  "SapPass": "...",
  "CompanyId": 123
}
```

---

## Storage — Mapeo de claves (⚠️ crítico)

| Dato | Angular legacy | Rails (Stimulus) | Mecanismo |
|---|---|---|---|
| Compañía seleccionada | `sessionStorage('SelectedCompany')` vía `StorageService.GetSelectedCompany()` | `SStore.get('CurrentCompany')` vía `company_selector_controller.js` | `SStore` = wrapper sobre `sessionStorage` del vendor `@clavisco/core` |
| Token de sesión | `localStorage('Session').access_token` | `Storage.get('Session').access_token` | `Storage` = wrapper sobre `localStorage` del vendor `@clavisco/core` |

> **Regla para futuras migraciones:** nunca leer `sessionStorage`/`localStorage` directamente con claves del legacy Angular. Siempre usar `SStore.get('CurrentCompany')` y `Storage.get('Session')` que son los helpers ya establecidos en el proyecto Rails.

---

## Lógica de Negocio

1. **On load:** `forkJoin` de GetUserInfo + GetGroupsByUser → poblar form con SapUser, cargar groupsList (no se renderiza en UI)
2. **Compañías asignables:** carga en paralelo → mapear `{Id, LegalName: EmsrNombre, ComercialName: EmsrNombreComercial}` → pre-seleccionar `companyId` desde `SStore.get('CurrentCompany').companyId`
3. **OCTypeControl visibility:** si `companyId` NO está en {186, 1206} → ocultar campo, limpiar validators, deshabilitar
4. **credentialsDirty tracking:** cualquier cambio en SapUser o SapPass activa `credentialsDirty=true` y resetea `credentialsValidated=false`
5. **Botón Actualizar bloqueado:** si hay cambios en credenciales pendientes de validar (`credentialsDirty && !credentialsValidated`)
6. **Éxito en actualización:** toast success + reload completo de la página (`OnLoad()`)

---

## Flujos de Usuario

### Flujo 1: Actualizar sólo SapUser (sin cambiar contraseña)
1. Página carga → SapUser lleno con valor actual, SapPass vacío
2. Usuario edita SapUser → `credentialsDirty=true`
3. Usuario selecciona compañía (select se habilita)
4. Usuario llena SapPass
5. Hace click "Probar credenciales" → validación exitosa → botón verde
6. Hace click "Actualizar" → éxito → reload

### Flujo 2: Actualizar preferencia Tipo de OC (empresa especial)
1. Solo disponible en compañías 186 o 1206
2. No requiere probar credenciales si no se tocan SapUser/SapPass
3. Actualizar habilitado directamente si form válido

### Flujo 3: Error en credenciales
1. Probar credenciales → API retorna false o error → modal de error
2. Botón Actualizar permanece deshabilitado (`credentialsDirty && !credentialsValidated`)

---

## Validaciones y Edge Cases

- Si SapUser o SapPass vacíos al probar credenciales → toast WARNING "Complete el Usuario y Contraseña..."
- Si `selectedCompanyId` nulo al probar credenciales → toast WARNING "Seleccione una compañía..."
- Error en GetUserInfo/forkJoin → modal error con mensaje del servidor
- `DocNumberPreference` se guarda como string (`.toString()`)

---

## Matriz de Funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Controlador + ruta | ❌ No | 0% | Crear desde cero |
| Vista ERB con form | ❌ No | 0% | Crear desde cero |
| Stimulus controller | ❌ No | 0% | Crear desde cero |
| Carga inicial (GetUserInfo + GetGroupsByUser) | ❌ No | 0% | |
| Carga compañías asignables | ❌ No | 0% | |
| Toggle visibilidad contraseña | ❌ No | 0% | |
| Select compañía (deshabilitado hasta credentialsDirty) | ❌ No | 0% | |
| Campo OCTypeControl condicional | ❌ No | 0% | |
| Probar credenciales (3 estados) | ❌ No | 0% | |
| Botón Actualizar con lógica credentialsDirty | ❌ No | 0% | |
| PATCH api/User/profile-info | ❌ No | 0% | |
| POST validate-user-credentials | ❌ No | 0% | |
| Toast success/error | ❌ No | 0% | |
