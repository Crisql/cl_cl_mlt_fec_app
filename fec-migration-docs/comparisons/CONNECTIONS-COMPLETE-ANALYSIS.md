# CONNECTIONS — Análisis Completo

**Módulo:** `configuration/connections`  
**Angular path:** `pages/configuration/connections/`  
**Rails path:** `configurations/connections`

---

## 1. Estructura general

Dos vistas:
1. **Lista** (`ConnectionsComponent`) — búsqueda + tabla
2. **Formulario** (`CreateOrUpdateConnectionComponent`) — crear / editar

---

## 2. Vista Lista

### 2.1 Formulario de búsqueda

| Campo | Tipo | Descripción |
|---|---|---|
| Server | text | Filtro por servidor |
| APIUrl | text | Filtro por URL API |

### 2.2 Botones de cabecera

| Botón | Ícono | Permiso | Acción |
|---|---|---|---|
| Consultar | `filter_alt` | ninguno | Re-ejecuta búsqueda |
| Crear | `add` | `Configurations_Connections_Create` | Navega a `/configurations/connections/new` |

### 2.3 Tabla

Columnas visibles (ignorando: DBPass, BoSuppLangs, DST, UseTrusted, RecordsCount, ServerType, ODBCType, LicenseServer):

| Columna Angular | Label tabla |
|---|---|
| Id | ID |
| Server | Servidor |
| DBUser | Usuario |
| DBEngine | Motor de base de datos |
| APIUrl | URL API |
| CrystalAPIUrl | URL Crystal API |

- Botón "Editar" por fila → permiso `Configurations_Connections_Update` → navega a `/configurations/connections/:id/edit`
- Sin permiso: toast INFO "No cuenta con permisos para realizar esta acción."

### 2.4 API

```
GET /api/Connections?server={Server}&apiUrl={APIUrl}
→ ICLResponse<ISAPConnection[]>
```

---

## 3. Vista Formulario

### 3.1 Campos

| Campo | Label | Tipo | Requerido |
|---|---|---|---|
| Server | Servidor | text | ✅ |
| LicenseServer | Servidor de Licencias | text | ❌ |
| APIUrl | URL API | text | ✅ |
| CrystalAPIUrl | URL Crystal API | text | ❌ |
| ODBCType | Tipo ODBC | text | ❌ |
| DBEngine | Motor de Base de Datos | text | ✅ |
| ServerType | Tipo de Servidor | text | ❌ |
| DBUser | Usuario de Base de Datos | text | ✅ |
| DBPass | Contraseña de Base de Datos | password (toggle) | ✅ solo en Crear |
| BoSuppLangs | Idiomas Soportados | text | ❌ |
| DST | DST | text | ❌ |
| UseTrusted | Usar Conexión de Confianza | checkbox | ❌ (default false) |

### 3.2 Modos

- **Crear** (`id = 0` o ruta `/new`): botón "Crear", DBPass required
- **Editar** (`id > 0`): botón "Actualizar", carga data vía API, DBPass opcional

### 3.3 Permisos

| Modo | Permiso requerido | Sin permiso |
|---|---|---|
| Crear | `Configurations_Connections_Create` | Modal WARNING + redirect a lista |
| Editar | `Configurations_Connections_Update` | Modal WARNING + redirect a lista |

### 3.4 API

```
GET    /api/Connections/:id   → cargar datos al editar
POST   /api/Connections       → crear
PATCH  /api/Connections       → actualizar
```

### 3.5 Validaciones

- Campos requeridos: Server, APIUrl, DBEngine, DBUser; DBPass solo en crear
- Si formulario inválido al guardar: toast WARNING "Por favor complete todos los campos requeridos"

### 3.6 Botones

| Botón | Acción |
|---|---|
| Cancelar | Navega a `/configurations/connections` |
| Crear/Actualizar | Llama API, toast SUCCESS si ok, modal ERROR si falla |

---

## 4. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Lista con tabla | ❌ | 0% | Por implementar |
| Búsqueda por Server/APIUrl | ❌ | 0% | Por implementar |
| Botón Crear (con permiso) | ❌ | 0% | Por implementar |
| Editar fila (con permiso) | ❌ | 0% | Por implementar |
| Formulario crear | ❌ | 0% | Por implementar |
| Formulario editar | ❌ | 0% | Por implementar |
| Toggle password visibility | ❌ | 0% | Por implementar |
| Validaciones requeridos | ❌ | 0% | Por implementar |
| Permisos en ambas vistas | ❌ | 0% | Por implementar |
