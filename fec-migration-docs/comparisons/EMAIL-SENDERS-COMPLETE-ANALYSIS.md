# EMAIL-SENDERS — Análisis Completo de Migración

**Angular legacy:** `/emailInbox` (EmailInboxComponent con dos tabs)
**Rails:** `GET /configurations/email-senders` (Configurations::EmailSendersController#index)

---

## Estructura de la página

Dos tabs:
1. **Bandeja de Correos** (EmailInboxConfigComponent) — gestión de configuraciones SMTP
2. **Asignación de Bandejas a Compañías** (EmailInboxAssigmentComponent) — drag-and-drop / click-to-move

---

## TAB 1: Bandeja de Correos

### Filtros

| Campo | Tipo   | Default | Valores                        |
|-------|--------|---------|-------------------------------|
| Email | text   | ''      | libre                         |
| SSL   | select | '2'     | 2=Todos, 1=Activo, 0=Inactivo |
| Host  | select | 'Todos' | cargado dinámicamente desde API |

**GET** `/api/EmailConfig/GetHost` → `{ HostList: string[] }` — ApiFEUrl

**Botones:** Buscar, Crear Bandeja

### Tabla

**Endpoint:** `POST /api/EmailConfig/SearchEmailConfig` — ApiFEUrl
```json
{ "Host": "", "Email": "", "SSL": "2", "StartPos": 1, "StepPos": 5 }
```

| Columna     | Campo         |
|-------------|---------------|
| Email       | Email         |
| Host        | Host          |
| Puerto      | Port          |
| SSL         | SSL (badge)   |
| A nombre de | SenderAddress |
| Acciones    | Actualizar, Visualizar |

### Panel lateral — Crear/Editar/Ver

**POST** `/api/EmailConfig/CreateEmailConfig` — ApiFEUrl
**PATCH** `/api/EmailConfig/UpdateEmailConfig` — ApiFEUrl
**POST** `/api/EmailConfig/ValidateEmailConfig` — ApiFEUrl

#### Campos

| Campo              | Tipo     | Validación               | Notas                              |
|--------------------|----------|--------------------------|------------------------------------|
| Email              | email    | required, pattern email  |                                    |
| Password           | password | required solo en CREATE  | toggle visibility                  |
| SenderAddress      | text     | opcional                 | "A nombre de" — remitente visible  |
| Host               | text     | required                 |                                    |
| Port               | number   | required                 |                                    |
| SSL                | checkbox | default: false           |                                    |
| Correo destinatario de prueba | email | solo create/edit | requerido para validar credenciales |

#### Lógica de negocio

- **Modo VIEW**: todos los campos deshabilitados; sin botones de validación/guardar
- **Modo EDIT**: Password no requerida (vacía = sin cambio)
- **Guardar deshabilitado** hasta "Probar credenciales" exitoso
- **Cualquier cambio** → resetea isValidated → deshabilita Guardar
- **ValidateEmailConfig** requiere `testRecipientEmail` válido antes de ejecutar

#### Payload ValidateEmailConfig
```json
{ "EmailConfig": { ...campos }, "RecipientEmail": "test@ejemplo.com" }
```

---

## TAB 2: Asignación de Bandejas a Compañías

### APIs

| Endpoint | Backend | Descripción |
|----------|---------|-------------|
| `GET /api/Companies/GetCompanies?status=active` | ApiAppUrl | Lista de compañías activas |
| `GET /api/CompanyEmailConfig/GetEmailInboxesByCompanyId?_companyId=X` | ApiFEUrl | Bandejas asignadas/disponibles para empresa |
| `POST /api/EmailConfig/EmailInboxAssignment?_companyId=X` | ApiFEUrl | Guardar asignación |

### Modelo respuesta GetEmailInboxesByCompanyId
```json
{ "ListEmailInboxesAssigned": [...], "ListEmailInboxesNotAssigned": [...] }
```

### Funcionalidad

1. Autocomplete de compañías (filtra por `EmsrIdeNumero-EmsrNombreComercial`)
2. Al seleccionar compañía → carga bandejas asignadas/disponibles
3. Click en ítem de "Bandejas Asignadas" → mueve a "Disponibles"
4. Click en ítem de "Disponibles" → mueve a "Bandejas Asignadas"
5. "Remover todos" → mueve todo de Asignadas a Disponibles
6. "Asignar todos" → mueve todo de Disponibles a Asignadas
7. "Guardar cambios" → POST con lista de `ListEmailInboxesAssigned`

---

## Matriz de funcionalidad

| Funcionalidad                              | Implementado | % | Notas |
|--------------------------------------------|:------------:|---|-------|
| Tab navigation                             | ✅ | 100 | |
| TAB1: Filtros (Email/SSL/Host)             | ✅ | 100 | |
| TAB1: Carga dinámica de hosts              | ✅ | 100 | |
| TAB1: Tabla con columnas correctas         | ✅ | 100 | |
| TAB1: Paginación                           | ✅ | 100 | |
| TAB1: Botón Crear Bandeja                  | ✅ | 100 | |
| TAB1: Panel crear (validación completa)    | ✅ | 100 | |
| TAB1: Panel editar (password opcional)     | ✅ | 100 | |
| TAB1: Panel ver (readonly)                 | ✅ | 100 | |
| TAB1: Probar credenciales con email prueba | ✅ | 100 | |
| TAB1: Guardar bloqueado hasta validar      | ✅ | 100 | |
| TAB1: Toggle visibility password          | ✅ | 100 | |
| TAB2: Autocomplete compañías               | ✅ | 100 | |
| TAB2: Cargar bandejas por compañía         | ✅ | 100 | |
| TAB2: Mover ítem individual                | ✅ | 100 | |
| TAB2: Remover todos / Asignar todos        | ✅ | 100 | |
| TAB2: Guardar asignación                   | ✅ | 100 | |
