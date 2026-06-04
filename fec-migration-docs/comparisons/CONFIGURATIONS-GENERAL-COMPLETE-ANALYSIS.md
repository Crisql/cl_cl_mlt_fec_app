# Análisis Completo — configurations/general

**Módulo Angular:** `pages/general-configs/general-configs.component`
**URL Rails:** `/configurations/general`
**Fecha:** 2026-06-04

---

## 1. Estructura de la página

Página simple (sin tabs, sin modales), un formulario con dos secciones:

1. **Formato de Impresión por Defecto** — campo readonly + upload + download + botón Actualizar
2. **Cédula Proveedor Sistemas** — campo de texto editable + botón Actualizar independiente

---

## 2. Campos

| Campo | Tipo | Validación | Default | Notas |
|---|---|---|---|---|
| `DefaultPrintFormatPath` | `<input readonly>` | `required` | vacío | Muestra solo el nombre del archivo (split `\`) |
| `CedulaProveedorSistemas` | `<input text>` | ninguna | vacío | Se carga desde `api/settings` con code `CedulaProveedorSistemas` |

---

## 3. Botones

| Botón | Condición visible | Condición habilitado | Acción |
|---|---|---|---|
| Upload (cloud_upload icon) | `hasPermissionToUploadDefaultPrintFormat` | siempre | Abre file picker, filtra `.rpt` |
| Download (download icon) | `hasPermissionToDownloadDefaultPrintFormat` | siempre | Descarga archivo `.rpt` de la API |
| Actualizar (formato) | `hasPermissionToUploadDefaultPrintFormat` | `genConfigForm.valid` (archivo seleccionado) | `PATCH api/GeneralConfigs?generalConfigsId={id}` con FormData |
| Actualizar (cédula) | siempre | siempre | `PATCH api/settings` con `{Code, Json, IsActive}` |

---

## 4. Llamadas API

| Método | Endpoint | Headers | Body | Respuesta |
|---|---|---|---|---|
| GET | `api/GeneralConfigs/GetGeneralConfigs` | `API: ApiAppUrl`, `X-Skip-Error-Interceptor` | — | `ICLResponse<GeneralConfigsModel[]>` → `Data[0]` |
| PATCH | `api/GeneralConfigs?generalConfigsId={id}` | `Request-With-Files: true`, `API: ApiAppUrl`, `X-Skip-Error-Interceptor` | `FormData { filePrintFormat: File }` | `ICLResponse<BaseResponse>` |
| GET | `api/settings` | `X-Skip-Error-Interceptor` | — | `ICLResponse<ISetting[]>` → find `CedulaProveedorSistemas` |
| PATCH | `api/settings` | `X-Skip-Error-Interceptor`, `X-Authorization-FESync: token` | `{Code, Json, IsActive}` | `ICLResponse<boolean>` |
| GET | `api/GeneralConfigs/default-print-format` | `X-Skip-Error-Interceptor` | — | Blob `.rpt` |

---

## 5. Modelo de datos

```typescript
interface GeneralConfigsModel {
  Id: number;
  DefaultPrintFormatPath: string; // ruta completa en servidor, se muestra solo el nombre
}

interface ISetting {
  Code: string;   // 'CedulaProveedorSistemas'
  Json: string;   // valor actual
  IsActive: boolean;
}
```

---

## 6. Lógica de negocio

- Al cargar: `GetGenConfigs()` + `GetSettings()` en paralelo
- `DefaultPrintFormatPath` se muestra como filename: `path.split('\\').at(-1)`
- `OnFileSelected`: valida extensión `.rpt`; si inválida → toast error + limpiar campo
- `OnSubmitEditGenConfigs`: solo si `form.valid && selectedFile != null` → `PATCH` multipart
- Tras `EditGeneralConfigs` exitoso → re-cargar `GetGenConfigs()`
- `UpdateCedulaProveedorSistemas`: siempre habilitado → `PATCH settings` → re-cargar `GetSettings()`
- `downloadDefaultPrintFormat`: crea Blob URL, click automático, revoca URL

---

## 7. Permisos

| Código | Uso |
|---|---|
| `Configurations_General_DownloadDefaultPrintFormat` | Muestra botón Download |
| `Configurations_General_UploadDefaultPrintFormat` | Muestra botón Upload + botón Actualizar (formato) |

---

## 8. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % | Notas |
|---|---|---|---|
| Vista ERB + controlador | ❌ No existe | 0% | A crear |
| Ruta `/configurations/general` | ❌ No existe | 0% | A agregar en routes.rb |
| Cargar GeneralConfigs (GET) | ❌ | 0% | |
| Mostrar nombre de archivo | ❌ | 0% | |
| Upload `.rpt` con validación | ❌ | 0% | |
| Actualizar formato (PATCH multipart) | ❌ | 0% | |
| Cargar Settings (GET) | ❌ | 0% | |
| Actualizar cédula (PATCH) | ❌ | 0% | |
| Download `.rpt` | ❌ | 0% | |
| Control de permisos | ❌ | 0% | |
