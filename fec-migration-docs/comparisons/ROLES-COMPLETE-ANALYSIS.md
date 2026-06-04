# Roles — Análisis Completo de Migración Angular → Rails

## Ruta
- **Angular legacy:** `/Rol`
- **Rails nuevo:** `/configurations/roles`

## Estructura de la página

Página simple (sin tabs) con:
1. **Botón "Nuevo"** en el header (color primary)
2. **Tabla `cl-table`** con lista de roles

## Campos / Modelo

```typescript
interface RolsModel {
  Id: number;        // ignorado en tabla
  Name: string;      // → "Nombre del Rol"
  Active: boolean;   // ignorado en tabla (se convierte en ActiveIcon)
  GroupId: number;   // ignorado en tabla
}
```

Columna virtual generada en cliente:
- `ActiveIcon`: icono thumb_up (#6BBC86 "Activo") o thumb_down (#EC7063 "Inactivo") según `Active`

## Configuración de la tabla

| Prop | Valor |
|------|-------|
| `tableIdrol` | `'rolTable'` |
| `isStandarHeaders` | `false` |
| `shouldSplitPascal` | `false` |
| Columnas visibles | `Name` → "Nombre del Rol", `ActiveIcon` → "Activo?" |
| Columnas ignoradas | `Id`, `GroupId`, `Active` |
| `iconColumns` | `['ActiveIcon']` |
| `hasPaginator` | `false` (scroll height 450px) |
| Botones | Editar (OPTION_1, icon: `edit`, color: `primary`) |

## Botones

| Botón | Condición habilitado | Acción |
|-------|---------------------|--------|
| Nuevo | Siempre | Abre RolDialog('Crear', null) |
| Editar (por fila) | Siempre visible, PERO si rol.Name == 'OWNER' → muestra toast "Este rol no permite su edición" | Abre RolDialog('Editar', element) |

## Llamadas API

| Método | Endpoint | Params | Header |
|--------|----------|--------|--------|
| GET | `api/Rol/GetRoles` | `?companyId={id}` | `API: ApiAppUrl`, `X-Skip-Error-Interceptor: true` |
| POST | `api/Rol` | body: `{role: RolsModel, companyId}` | idem |
| PATCH | `api/Rol` | body: `{role: RolsModel, companyId}` | idem |

## Dialog Crear/Editar (RolDialogComponent)

**Campos:**
- `Rolname` (text, required) — "Nombre del Rol"

**Botones dialog:**
- Cancelar → cierra dialog con `false`
- Crear / Modificar (disabled si form inválido)
  - Create: `Id=0`, `Active=true`, `GroupId=0`
  - Edit: `Id=rol.Id`, `Active=true`, `GroupId=0` (mantiene estado)

**Payload POST/PATCH:**
```json
{
  "role": { "Id": 0, "Name": "...", "Active": true, "GroupId": 0 },
  "companyId": 123
}
```

**Cierre:** Al cerrar con `true` → recarga tabla `GetRoles()`

## Lógica de negocio

- `companyId` se lee del storage: `CurrentCompany.companyId`
- `SetNameAction(this.Name)` → establece título "Roles Existentes" en el header del layout

## Flujos de usuario

1. **Ver roles:** Página carga → lee companyId del storage → GET GetRoles → tabla
2. **Crear rol:** Click "Nuevo" → dialog → llenar Nombre → Crear → POST → toast éxito → recarga tabla
3. **Editar rol:** Click "Editar" en fila (si no es OWNER) → dialog prellenado → Modificar → PATCH → toast éxito → recarga tabla
4. **Editar OWNER:** Click "Editar" → toast INFO "Este rol no permite su edición"

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Ruta /configurations/roles | ❌ | 0% | Crear |
| Controller Rails | ❌ | 0% | Crear |
| Vista ERB (tabla + botón Nuevo) | ❌ | 0% | Crear |
| Stimulus: carga roles via API | ❌ | 0% | Crear |
| Stimulus: tabla con iconos activo/inactivo | ❌ | 0% | Crear |
| Stimulus: botón Nuevo → modal crear | ❌ | 0% | Crear |
| Stimulus: editar fila → modal editar | ❌ | 0% | Crear |
| Stimulus: bloqueo edición OWNER | ❌ | 0% | Crear |
| Stimulus: POST crear rol | ❌ | 0% | Crear |
| Stimulus: PATCH editar rol | ❌ | 0% | Crear |
