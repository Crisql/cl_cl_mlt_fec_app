# Branches (Sucursal) — Análisis Completo

**Ruta Angular:** `/sucursal`
**Ruta Rails:** `/configurations/branches`
**Módulo:** `configurations`
**Análisis:** Junio 2026

---

## Estructura de la página

Página simple: toolbar con botón "Nueva Sucursal" + tabla Tabulator con paginación client-side.
El formulario de crear/editar se abre en un **panel lateral** (migración del `MatDialog` Angular que tenía `height: 625px`).

---

## Llamadas API

| Método | Endpoint | Trigger |
|---|---|---|
| GET | `/api/Sucursal/GetSucursalByCompany?companyId={id}` | Carga inicial |
| POST | `/api/Sucursal` | Crear sucursal |
| PATCH | `/api/Sucursal` | Actualizar sucursal |
| GET | `/Country.json` | Datos de ubicación (local) |
| GET | `/Provinces.json` | Lista de provincias (local) |

---

## Tabla

Columnas visibles (en orden):

| Campo Angular | Label | Notas |
|---|---|---|
| `SucursalNum` | Sucursal | Número de sucursal |
| `Alias` | Alias | — |
| `EmsrUbProvincia` | Provincia | Mapeado a nombre desde Provinces.json |
| `EmsrUbCanton` | Cantón | Mapeado a nombre desde Country.json |
| `EmsrUbDistrito` | Distrito | Mapeado a nombre desde Country.json |
| `EmsrUbBarrio` | Barrio | Valor raw de la API |
| `EmsrUbOtrasSenas` | Otras señas | — |
| `Active` | Activo | Badge Activo/Inactivo |
| — | Acciones | Botón editar |

Campos ignorados en tabla: `Id`, `EmsrUbProvincia` (raw), `EmsrUbCanton` (raw), `EmsrUbDistrito` (raw), `EmsrTlfCodigoPais`, `EmsrTlfNumTelefono`, `EmsrFaxCodigoPais`, `EmsrFaxNumTelefono`, `EmsrCorreoElectronico`, `CompanyId`, `MaxQtyRowsFetch`.

Botones de fila: solo `Editar` (ícono `edit`).

---

## Formulario crear/editar (Panel lateral)

| Campo | Tipo | Validación | Notas |
|---|---|---|---|
| `SucursalNum` | number | required, pattern `^[0-9]\d*$` (mayor a 0) | Solo números |
| `Country` | text | — | Fijo "Costa Rica", disabled |
| `EmsrUbProvincia` | select | required | Opciones de Provinces.json |
| `EmsrUbCanton` | select | required | Filtrado por provincia |
| `EmsrUbDistrito` | select | required | Filtrado por cantón |
| `EmsrUbBarrio` | autocomplete | required | Filtrado por distrito, búsqueda por texto |
| `EmsrUbOtrasSenas` | text | required | Dirección |
| `EmsrTlfNumTelefono` | text | required | Solo números |
| `EmsrFaxNumTelefono` | text | — | Solo números, opcional |
| `EmsrCorreoElectronico` | email | required, pattern email | — |
| `Alias` | text | required | — |
| `Active` | checkbox | — | Default: true en creación |

### Lógica de cascada (onChange)

1. Cambio de **Provincia** → recarga cantones, resetea cantón al primero (`CantonId` del primer ítem), recarga distritos del primer cantón, recarga barrios del primer distrito
2. Cambio de **Cantón** → recarga distritos, resetea distrito al primero, recarga barrios del primer distrito
3. Cambio de **Distrito** → recarga barrios del primer barrio

### Payload POST/PATCH

```json
{
  "Id": 0,
  "CompanyId": 42,
  "SucursalNum": 1,
  "EmsrUbProvincia": "01",
  "EmsrUbCanton": "01",
  "EmsrUbDistrito": "01",
  "EmsrUbBarrio": "Nombre del barrio",
  "EmsrUbOtrasSenas": "Dirección completa",
  "EmsrTlfCodigoPais": 506,
  "EmsrTlfNumTelefono": "22221111",
  "EmsrFaxCodigoPais": 506,
  "EmsrFaxNumTelefono": "",
  "EmsrCorreoElectronico": "correo@ejemplo.com",
  "Active": true,
  "Alias": "Sucursal Central"
}
```

- En PATCH: `Id` = id de la sucursal existente
- `EmsrTlfCodigoPais` y `EmsrFaxCodigoPais` siempre 506 (Costa Rica)
- `EmsrFaxNumTelefono`: si vacío enviar `''`

---

## Permisos

No se encontró control de permisos específico para el componente Angular.
El módulo usa autenticación básica (token Bearer).

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Tabla con lista de sucursales | ✅ | 100% | — |
| Paginación client-side | ✅ | 100% | — |
| Badge Activo/Inactivo | ✅ | 100% | — |
| Mapeo provincia/cantón/distrito por nombre | ✅ | 100% | JSON local |
| Panel crear sucursal | ✅ | 100% | — |
| Panel editar sucursal | ✅ | 100% | — |
| Cascada provincia→cantón→distrito→barrio | ✅ | 100% | — |
| Autocomplete barrio | ✅ | 100% | — |
| Validaciones formulario | ✅ | 100% | — |
| POST /api/Sucursal | ✅ | 100% | — |
| PATCH /api/Sucursal | ✅ | 100% | — |
| Toast éxito / Modal error | ✅ | 100% | — |
