# MENU + COMPANY SELECTOR — Análisis Completo

## Fuentes Angular
- `shared/menu/menu.component.ts|html`
- `core/services/menu.service.ts`
- `pages/matDialog/select-company-dialog/`
- `pages/pages.component.ts|html`

---

## 1. Layout protegido (`pages.component`)
- Envuelve todas las páginas autenticadas
- Abre `SelectCompanyDialogComponent` cuando `storage.companySelectionRequested$` emite
- En Rails: `layouts/protected.html.erb`

---

## 2. Sidebar Menu

### Nodos del menú (menu.service.ts)
| Key | Label | Icon | Route | Siempre visible | Permission |
|---|---|---|---|---|---|
| home | Inicio | house | /home | ✅ | — |
| documents | Documentos | folder_open | — | ❌ | M_Documents |
| ↳ issued_documents | Documentos Emitidos | — | /documents/issued | ❌ | Documents_Issued_ViewDocuments |
| ↳ accept_documents | Aceptación Documentos | — | /documents/receptions | ❌ | Documents_Reception_ViewDocuments |
| ↳ ... (9 sub-items) | | | | | |
| reports | Reportes | print | /docReport | ❌ | S_DocumentReport / S_DocumentReceptionReport |
| settings | Configuración | settings_suggest | — | ❌ | M_Config |
| ↳ ... (14 sub-items) | | | | | |
| textFilesLogs | Logs | terminal | /logs | ❌ | Logs_Access |
| logout | Cerrar sesión | logout | /login | ✅ | — |

### Lógica de visibilidad
- `home` y `logout` siempre visibles
- Nodos padre: visibles si tiene permiso propio O si algún hijo tiene permiso
- Nodos hijo: visibles si el usuario tiene el permiso requerido
- Permisos multi-valor: basta con tener UNO de los permisos del array

### Fuente de permisos
`GET /api/Permission/GetPermsByUser?companyId=X` → `ICLResponse<{Name: string}[]>`
Almacenados en `localStorage.Permissions` como `string[]`

### Toggle collapse
- Botón en toolbar → colapsa/expande sidebar
- Estado persiste en `localStorage.menuState.isCollapsed`

### Click en ítem de menú
- Si `key === 'logout'` → limpiar sesión → `window.location.href = '/login'`
- Si tiene sub-nodos → expandir/colapsar grupo
- Si tiene ruta → navegar a la ruta

---

## 3. Toolbar
| Elemento | Descripción |
|---|---|
| Botón toggle menu | Muestra/oculta sidebar |
| Título de página | Texto dinámico por módulo (equivalente a `generalConfig.SetNameAction`) |
| Label "Compañía:" | Estático |
| Botón empresa | Muestra `companyName`, click → abre company selector |
| Context menu (click derecho) | Solo si tiene permiso `F_ModifyCompany` → navega a `/configurations/companies/{id}/edit` |

### Datos
- `Session.UserEmail` → nombre de usuario (mostrado en cl-menu header)
- `CurrentCompany.companyName` → nombre en botón empresa
- `CurrentCompany.companyId` → tooltip en botón empresa

---

## 4. Company Selector (Modal)

### Trigger
- Click en botón empresa del toolbar
- Al cargar la app sin empresa seleccionada (`!CurrentCompany`)

### Comportamiento
1. `GET /api/Companies/GetCompanies?ComercialName=&LegalName=&Identification=&status=active`
2. Mostrar lista filtrable, formato: `"EmsrIdeNumero - EmsrNombreComercial"`
3. Botón Cancelar: solo si ya hay empresa seleccionada (`showCancelButton`)
4. Botón Continuar: habilitado solo si hay empresa seleccionada en el input

### Al seleccionar
1. Validar que la empresa existe en la lista
2. Si es la misma empresa → cerrar modal sin cambios
3. Si es diferente:
   a. `Storage.set('CurrentCompany', { companyName, companyId, codigoActividad, groupId, UseFactProv, SendReceptAndApInv })`
   b. `localStorage.removeItem('Permissions')`
   c. `GET /api/Permission/GetPermsByUser?companyId=X` → guardar en `localStorage.Permissions`
   d. `window.location.reload()`

### Formato de `CurrentCompany` en localStorage
```json
{
  "companyName": "Nombre Comercial",
  "companyId": 123,
  "codigoActividad": "123456",
  "groupId": 1,
  "UseFactProv": false,
  "SendReceptAndApInv": false
}
```

---

## 5. Matriz de funcionalidad

| Funcionalidad | Rails | % |
|---|---|---|
| Layout protegido con sidebar + toolbar | ✅ | 100% |
| Nodos del menú completos | ✅ | 100% |
| Visibilidad por permisos | ✅ | 100% |
| Toggle sidebar | ✅ | 100% |
| Navegación entre rutas | ✅ | 100% |
| Logout | ✅ | 100% |
| Sub-menús colapsables | ✅ | 100% |
| Toolbar con título de página | ✅ | 100% |
| Botón empresa + company selector modal | ✅ | 100% |
| Autocomplete filtrable de empresas | ✅ | 100% |
| Persistencia empresa en localStorage | ✅ | 100% |
| Reload de permisos al cambiar empresa | ✅ | 100% |
| Context menu empresa (F_ModifyCompany) | ✅ | 100% |
| Username en header del menú | ✅ | 100% |
