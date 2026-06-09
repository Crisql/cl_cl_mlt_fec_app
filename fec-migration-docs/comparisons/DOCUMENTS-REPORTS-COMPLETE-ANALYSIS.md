# Análisis Completo — Módulo Reportes de Documentos
**Ruta Angular:** `/docReport`  
**Ruta Rails:** `/documents-reports`  
**Fecha de análisis:** 2026-06-09

---

## 1. Estructura de la página

Página sin tabs ni modales propios. Una sola vista con:
- Formulario de filtros (fechas + tipo de reporte)
- Botón "Consultar"

---

## 2. Campos del formulario

| Campo | Tipo | Default | Validación |
|---|---|---|---|
| `StartDate` | date picker | Fecha actual | Requerido, no puede ser futura, ≤ EndDate |
| `EndDate` | date picker | Fecha actual | Requerido, no puede ser futura, ≥ StartDate |
| `ToggleRD` | radio group | `1` | Requerido |

**Radio buttons (ToggleRD):**
- Valor `1` → "Reporte de Documentos" (visible solo si perm `S_DocumentReport`)
- Valor `2` → "Reporte de Documentos Recepcionados" (visible solo si perm `S_DocumentReceptionReport`)

---

## 3. Botones

| Botón | Icono | Cuándo habilitado | Acción |
|---|---|---|---|
| Hoy (StartDate) | — | Siempre | Setea StartDate = fecha actual |
| Hoy (EndDate) | — | Siempre | Setea EndDate = fecha actual |
| Consultar | `filter_alt` | Formulario válido | Llama GetDocReport o GetDocReceptReport según ToggleRD |

---

## 4. Lógica de negocio

### Al cargar (OnLoad)
1. Inicializa el formulario con fecha actual en ambos campos.
2. Lee permisos del storage: `S_DocumentReport` y `S_DocumentReceptionReport`.
3. Si tiene `S_DocumentReport` → ToggleRD = 1, título del header = "Reporte de Documentos".
4. Si no pero tiene `S_DocumentReceptionReport` → ToggleRD = 2, título = "Reporte de Documentos Recepcionados".
5. Escucha `valueChanges` para actualizar el título del header con el tipo seleccionado.

### Al hacer clic en "Consultar" (ButtonAction)
1. Valida que StartDate y EndDate no sean null (muestra modal info si lo son).
2. Valida: StartDate ≤ hoy, EndDate ≤ hoy, StartDate ≤ EndDate (muestra modal info si falla).
3. Según ToggleRD llama a `GetDocReport` o `GetDocReceptReport`.

### GetDocReport / GetDocReceptReport
1. Muestra overlay "Generando reporte, espere por favor...".
2. Llama API GET con params: StartDate (yyyy-MM-dd), EndDate (yyyy-MM-dd), CompanyId.
3. Si `data.Data` existe → decodifica base64 → abre en nueva pestaña como PDF.
4. Si `data.Data` vacío → toast warning "Lo sentimos, no hay información disponible...".
5. En error → toast error con mensaje de API.
6. Siempre → oculta overlay al finalizar.

---

## 5. Llamadas API

| Método | Endpoint | Backend | Params |
|---|---|---|---|
| GET | `/api/Report/GetDocReport` | `ApiAppUrl` | StartDate, EndDate, CompanyId |
| GET | `/api/Report/GetDocReceptReport` | `ApiAppUrl` | StartDate, EndDate, CompanyId |

**Formato de fecha:** `yyyy-MM-dd` (ISO).
**Respuesta:** `ICLResponse<string>` donde `Data` es base64 de un PDF.

---

## 6. Permisos

| Permiso | Efecto |
|---|---|
| `S_DocumentReport` | Muestra opción "Reporte de Documentos" |
| `S_DocumentReceptionReport` | Muestra opción "Reporte de Documentos Recepcionados" |
| Ninguno | No debería poder acceder (el menú no aparece) |

---

## 7. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Formulario con fechas + Hoy | ❌ | 0% | Pendiente |
| Radio buttons con permisos | ❌ | 0% | Pendiente |
| Validación de fechas | ❌ | 0% | Pendiente |
| GET /api/Report/GetDocReport | ❌ | 0% | Pendiente |
| GET /api/Report/GetDocReceptReport | ❌ | 0% | Pendiente |
| Abrir PDF en nueva pestaña | ❌ | 0% | Pendiente |
| Toast warning sin datos | ❌ | 0% | Pendiente |
| Overlay durante carga | ❌ | 0% | Pendiente |
| Ruta /documents-reports | ❌ | 0% | Pendiente |
| Menú apuntando a nueva ruta | ❌ | 0% | Pendiente en menu_controller.js |
