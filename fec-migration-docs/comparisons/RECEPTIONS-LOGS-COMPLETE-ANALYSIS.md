# COMPLETE-ANALYSIS: documents/receptions/logs
## Angular route: /mailParser → Rails: /documents/receptions/logs

## Fuente Angular
- `pages/documents/log/log.component.ts`
- `core/services/log.service.ts`
- `core/interfaces/i-log.ts`

---

## Estructura de la página

Una sola vista con:
1. **Card de filtros** — formulario con rango de fechas + botón "Hoy" por campo + botón "Consultar"
2. **Card de tabla** — tabla con paginación server-side (tipo `dba`) con botón de acción "Descargar Email"

---

## Campos del formulario

| Campo | Tipo | Default | Validación |
|---|---|---|---|
| StartDate | Date picker | fecha actual | requerido, ≤ hoy, ≤ EndDate |
| EndDate | Date picker | fecha actual | requerido, ≤ hoy, ≥ StartDate |

**Botón "Hoy"** en cada campo restablece al día actual (`actualDate = new Date()`).

**Validación de rango** (`isValidDateRange`):
- StartDate y EndDate deben existir
- Ambas ≤ today
- StartDate ≤ EndDate
- Si falla → modal informativo (no toast)

---

## Llamadas API

### GET logs
- Endpoint: `api/Log/GetMailParserLogs`
- Backend: `ApiAppUrl` (App server — header default)
- Parámetros: `companyId`, `FFini` (YYYY-MM-DD), `FFin` (YYYY-MM-DD)
- Response: `ICLResponse<GetEmailProcessorLogDto[]>`
- Éxito con datos → toast success
- Éxito sin datos → toast info con `data.Message`
- Error → toast error

### GET descargar email
- Endpoint: `api/Log/email-processor/{id}/email`
- Backend: `ApiAppUrl`
- Response type: blob
- Content-Disposition header → extrae `filename` (regex)
- Descarga automática con `<a>` tag
- Error si blob es JSON → parsear y mostrar toast error

---

## Columnas de la tabla

| Columna original | Label en UI | Visible |
|---|---|---|
| Id | — | NO (ignorada) |
| TrxDate | — | NO (ignorada) |
| TrxDateC | Fecha Log | SÍ (computed: TrxDate formateada) |
| FileName | Archivo | SÍ |
| EmailFrom | Remitente | SÍ |
| Status | Estado | SÍ |
| Exception | Error | SÍ |
| MailParserInboxEmail | Bandeja de Entrada | SÍ |
| DocType | — | NO (ignorada) |

**TrxDateC** = `TrxDate` formateado con `DATE_TIME_SHORT_FORMAT` (= `'M/d/yy, h:mm a'` en Angular → equivale a `yyyy-MM-dd HH:mm:ss` per CLAUDE.md)

---

## Botones de acción en tabla

| Botón | Ícono | Acción |
|---|---|---|
| Descargar Email | `mail` | `downloadEmail(element)` → GET blob + auto-download |

---

## Interfaz `GetEmailProcessorLogDto`

```typescript
{
  Id: number;
  TrxDate: Date;
  FileName: string;
  EmailFrom: string;
  Status: string;
  Exception: string;
  MailParserInboxEmail: string;
}
```

---

## Permisos

Angular usa `VerifyPermissionsGuard` en la ruta. No hay lógica de permisos
dentro del componente (ningún método `hasPerm`). La página completa requiere
autenticación pero no chequea permisos específicos por acción.

---

## Flujos de usuario

1. **Buscar logs**: seleccionar fechas → clic "Consultar" → GET → tabla cargada
2. **Descargar email**: clic botón mail en fila → GET blob → descarga automática
3. **Seleccionar hoy**: clic "Hoy" junto a un date input → el campo se resetea a fecha actual
4. **Error de rango de fechas**: si fechas inválidas → modal info, no ejecuta API

---

## Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Formulario de fechas | ❌ | 0% | Crear desde cero |
| Botón "Hoy" | ❌ | 0% | JS simple |
| Validación de rango | ❌ | 0% | |
| Tabla con paginación | ❌ | 0% | Tabulator remote |
| Columna Fecha Log formateada | ❌ | 0% | |
| Badge de estado | ❌ | 0% | Según CLAUDE.md sección 1 |
| Botón Descargar Email | ❌ | 0% | Requiere manejo de blob |
| Modal error rango fechas | ❌ | 0% | |
| Toast success/info/error | ❌ | 0% | |
| Overlay loader | ❌ | 0% | Tipo B (overlay service) |
