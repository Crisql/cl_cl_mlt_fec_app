# MAIL-PARSER — Análisis Completo de Migración

**Angular legacy:** `/configurations/mail-parser-config` (MailParserConfigComponent)
**Rails:** `GET /configurations/mail-parser` (Configurations::MailParserController#index)

---

## Estructura de la página

Página única (sin tabs) con:
1. Card de filtros
2. Tabla Tabulator con paginación
3. Panel lateral "Ver Compañías Emisoras" (abre a la derecha de la tabla, colapsable)
4. Panel lateral "Crear/Editar configuración" (slide-in desde la derecha, full-height)

---

## Filtros

| Campo       | Tipo     | Default | Valores posibles                     |
|-------------|----------|---------|---------------------------------------|
| Email       | text     | ''      | libre                                 |
| ServerName  | text     | ''      | libre                                 |
| Company     | text     | ''      | libre                                 |
| Status      | select   | 2       | 2=Ambos, 1=Activo, 0=Inactivo         |
| UseToken    | select   | 2       | 2=Ambos, 1=Sí, 0=No                   |

**Botones:** Consultar (search), Crear Nuevo (openCreatePanel)

---

## Tabla

**Endpoint:** `GET /api/mail-parser?mailServer=&mail=&status=&emsrNombre=&useToken=&startPost=&stepPost=`
**Backend:** ApiAppUrl (default)

| Columna       | Campo        | Notas                         |
|---------------|--------------|-------------------------------|
| ID            | Id           |                               |
| Servidor      | MailServer   |                               |
| Correo        | Email        |                               |
| Puerto        | Port         |                               |
| Compañía      | EmsrNombre   | '-' si vacío                  |
| Usa Token     | UseToken     | Badge Activo/Inactivo (Sí/No) |
| Automática    | IsAutomatic  | Badge Activo/Inactivo (Sí/No) |
| Activa        | Status       | Badge: Status===1 → Activo    |
| Acciones      | -            | Editar + Ver Compañías        |

---

## Panel lateral — Crear/Editar

**POST** `/api/mail-parser` (crear)
**PATCH** `/api/mail-parser` (editar)
**POST** `/api/mail-parser/validate` (probar credenciales)

### Campos base (siempre visibles)

| Campo              | Tipo        | Validación               | Notas                             |
|--------------------|-------------|--------------------------|-----------------------------------|
| ServerDirection    | text        | required                 | maps → MailServer                 |
| Email              | email       | required, pattern email  |                                   |
| CompanyId          | autocomplete| opcional                 | GET /api/Companies/for-assignment |
| Password           | password    | required en CREATE; oculto si UseToken=true | toggle visibility |
| Port               | number      | required                 |                                   |
| Status             | checkbox    | default: true (checked)  | maps → Status: 1/0                |
| IsAutomatic        | checkbox    | default: false           |                                   |
| UseToken           | checkbox    | default: false           | onChange: toggle campos token     |

### Campos token (visibles solo cuando UseToken=true)

| Campo        | Tipo  | Validación |
|--------------|-------|------------|
| TenantId     | text  | required   |
| URL          | text  | required   |
| GrantType    | text  | required   |
| Scope        | text  | required   |
| ClientSecret | text  | required   |
| ClientId     | text  | required   |

### Lógica de negocio

- **UseToken onChange** → toggle campos token; limpiar isValidated; deshabilitar Guardar
- **Guardar deshabilitado** hasta que se presione "Probar credenciales" y sea exitoso
- **En edición**: Password no es requerida (se envía vacía si no se cambia)
- **Cualquier cambio en el formulario** → resetea isValidated → deshabilita Guardar

### Botones del footer

| Botón               | Comportamiento                                           |
|---------------------|----------------------------------------------------------|
| Cancelar            | closePanel()                                             |
| Probar credenciales | POST /api/mail-parser/validate; si OK → habilita Guardar |
| Guardar             | disabled hasta credenciales validadas; POST/PATCH        |

---

## Panel de Compañías Emisoras

**Endpoint:** `GET /api/mail-parser/processing-tenants/{mailParserConfigId}`
**Toggle estado:** `PATCH /api/mail-parser/processing-tenants/{tenantId}/status` `{ IsActive: bool }`
**Backend:** ApiAppUrl

### Modelo InboxProcessingTenant
```ts
{ Id, CompanyId, MailParserConfigurationId, IsActive, CompanyName, CompanyIdentification }
```

### Funcionalidad
- Se abre cuando se hace click en "Ver Compañías" en una fila de la tabla
- Si se hace click en el mismo ID con el panel ya abierto → se cierra
- Campo de búsqueda filtra por: CompanyName, CompanyIdentification, CompanyId
- Badge de estado clickeable → modal de confirmación → toggle IsActive
- Permiso de toggle: `Configurations_MailParser_UpdateAllProcessingTenantStatus` o `Configurations_MailParser_UpdateProcessingTenantStatus`
  - **Nota Rails:** actualmente el toggle siempre aparece (se omitió chequeo de permisos en primera versión)

---

## Matriz de funcionalidad

| Funcionalidad                          | Implementado | % | Notas                             |
|----------------------------------------|:------------:|---|-----------------------------------|
| Filtros (Email/Server/Company/Status/UseToken) | ✅ | 100 | |
| Tabla con columnas correctas           | ✅ | 100 | |
| Badges de estado                       | ✅ | 100 | |
| Paginación server-side                 | ✅ | 100 | |
| Botón Crear Nuevo                      | ✅ | 100 | |
| Panel lateral crear                    | ✅ | 100 | |
| Panel lateral editar                   | ✅ | 100 | |
| Autocomplete compañías                 | ✅ | 100 | |
| Toggle UseToken → campos condicionales | ✅ | 100 | |
| Probar credenciales (validate)         | ✅ | 100 | |
| Guardar bloqueado hasta validar        | ✅ | 100 | |
| Toggle password (visibility)           | ✅ | 100 | |
| Panel Compañías Emisoras               | ✅ | 100 | |
| Búsqueda en panel tenants              | ✅ | 100 | |
| Toggle estado tenant (confirm)         | ✅ | 100 | Confirm nativo (no modal custom) |
| Chequeo de permisos para toggle tenant | ⚠️ | 0  | No implementado — ver nota       |
