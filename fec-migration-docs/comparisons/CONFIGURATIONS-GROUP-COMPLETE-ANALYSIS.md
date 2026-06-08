# CONFIGURATIONS/GROUP — Análisis Completo de Migración

## URL Angular → Rails
- Angular: `/configurations/groups`
- Rails target: `/configurations/group`

---

## Estructura de la Página

Una sola página (sin tabs de navegación), con:
1. **Card "Datos de la Cuenta"** — formulario con info del grupo actual
2. **Tab "Usuarios de la Cuenta"** — tabla de usuarios del grupo
3. **Tab "Compañías de la Cuenta"** — tabla de compañías del grupo

---

## Campos del Formulario (Card principal)

| Campo | Control | Tipo | Validación | Comportamiento |
|---|---|---|---|---|
| Nombre | `GroupName` | `input[readonly]` | required | Solo lectura — viene de la API |
| Descripción | `GroupDescription` | `input` | required | Editable |
| Formato de Impresión por Defecto | `DefaultPrintFormatPath` | `input[readonly]` + file picker | required | Solo lectura, con botones sufijo |

### Botones sufijo del campo "Formato de Impresión"
- `attach_file` — abre file picker oculto (acepta solo `.rpt`)
- `download` — descarga el formato actual (solo si `hasPermissionToDownloadPrintFormat`)

---

## Botones de Acción

| Botón | Ícono | Condición visible | Acción |
|---|---|---|---|
| Actualizar | `refresh` | `hasPermissionToUpdateGroup` | `PATCH api/Group` con FormData (Group + file) |
| Restablecer Formato | `refresh` | `hasPermissionToUpdateGroup` | Abre modal de confirmación → `PATCH api/Group/ResetPrintFormat?groupId={id}` |
| Crear | `add` | `hasPermissionToCreateGroups` | Abre panel lateral (modal en Angular) de creación |

---

## Permisos

| Variable | Permisos requeridos |
|---|---|
| `hasPermissionToUpdateGroup` | `Configurations_Groups_Update` OR `Configurations_Groups_UpdateAllInApplication` |
| `hasPermissionToDownloadPrintFormat` | `Configurations_Groups_DownloadFEPrintFormatInAllGroups` OR `Configurations_Groups_DownloadFEPrintFormat` |
| `hasPermissionToCreateGroups` | `Configurations_Groups_Create` |

---

## Llamadas API

| Operación | Método | Endpoint | Parámetros |
|---|---|---|---|
| Cargar grupo del usuario | GET | `api/Group/GetGroupsByUser?companyId={id}` | companyId de sessionStorage |
| Cargar compañías del grupo | GET | `api/Companies/GetCompaniesByGroup?groupId={id}` | groupId de la respuesta anterior |
| Cargar usuarios del grupo | GET | `api/User/GetUsersByGroup?companyId={id}` | companyId de sessionStorage |
| Actualizar grupo | PATCH | `api/Group` | FormData: `Group` (JSON) + `file` (opcional) |
| Restablecer formato | PATCH | `api/Group/ResetPrintFormat?groupId={id}` | groupId |
| Descargar formato | GET | `api/Group/{groupId}/print-format` | — (response: Blob) |
| Crear grupo | POST | `api/Group` | `{ Id:0, GroupName, GroupDescription, DefaultPrintFormatPath:'' }` |

### Header especial para PATCH (con archivo)
```
'Request-With-Files': 'true'
```

---

## Tablas

### Tabla Usuarios (`tblUsersByGroups`)
Columnas: `UserName` (→ "Usuario"), `Email` (→ "Email")  
Sin paginador. Sin acciones por fila.

### Tabla Compañías (`tblGroupsByCompany`)
Columnas visibles: `Identification` (→ "Identificación"), `LegalName` (→ "Nombre Legal"), `ComercialName` (→ "Nombre Comercial"), `Active` (→ "Activa")  
`Active` se renderiza como badge Activo/Inactivo.  
Sin paginador. Sin acciones por fila.

---

## Panel/Modal "Crear Grupo"

Formulario con:
- `GroupName` — requerido
- `GroupDescription` — opcional

Botones: Cancelar / Crear (disabled si form inválido)  
API: `POST api/Group`

---

## Flujos de Usuario

### Carga inicial
1. Leer `companyId` de `sessionStorage.CurrentCompany`
2. GET `GetGroupsByUser?companyId=X`
3. Poblar formulario con `Data[0]` (GroupName, GroupDescription, DefaultPrintFormatPath — solo nombre del archivo)
4. GET `GetCompaniesByGroup?groupId=Data[0].Id`
5. GET `GetUsersByGroup?companyId=X`
6. Renderizar ambas tablas

### Actualizar grupo
1. Validar form (GroupDescription required)
2. PATCH `api/Group` con FormData → `Group` JSON + archivo si fue seleccionado
3. Éxito: toast success "Grupo actualizado exitosamente"

### Restablecer formato de impresión
1. Abrir modal de confirmación WARNING
2. Si confirma: PATCH `api/Group/ResetPrintFormat?groupId=X`
3. Éxito: toast success + recargar datos

### Subir archivo .rpt
1. Click en `attach_file` → abre input[type=file] oculto
2. Validar extensión `.rpt` — si no es `.rpt`: limpiar + toast error
3. Si válido: mostrar nombre en campo readonly

### Descargar formato
1. GET `api/Group/{groupId}/print-format` → Blob
2. Crear `<a>` temporal, descargar con el nombre del campo `DefaultPrintFormatPath`

### Crear grupo
1. Abrir panel lateral con formulario
2. Rellenar GroupName (required), GroupDescription (opcional)
3. POST `api/Group`
4. Éxito: toast success + cerrar panel + recargar datos

---

## Matriz de Funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Ruta `/configurations/group` | ❌ | 0% | No existe en routes.rb |
| Controller + View base | ❌ | 0% | No existe |
| Stimulus controller | ❌ | 0% | No existe |
| Carga inicial del grupo | ❌ | 0% | |
| Formulario con campos | ❌ | 0% | |
| Tabla usuarios | ❌ | 0% | |
| Tabla compañías | ❌ | 0% | |
| Actualizar grupo | ❌ | 0% | |
| Restablecer formato | ❌ | 0% | |
| Subir .rpt | ❌ | 0% | |
| Descargar formato | ❌ | 0% | |
| Panel "Crear grupo" | ❌ | 0% | |
| Control de permisos | ❌ | 0% | |
