# HOME — Análisis Completo de Migración Angular → Rails

## Fuente Angular
`legacy/web_angular/src/app/pages/home/home.component.ts|html|scss`

---

## 1. Estructura de la Página

La página `/home` es un dashboard con dos secciones:

1. **Banner** (condicional) — imagen clickeable con botón de cierre
2. **Grid de 6 gráficos** — 3 filas × 2 columnas, cada uno en un `mat-card`

No hay tabs, formularios ni modales propios de este módulo.

---

## 2. Datos de sesión utilizados (localStorage)

| Clave Angular (`StorageService`) | Clave localStorage (Rails vendor) | Contenido relevante |
|---|---|---|
| `storage.GetItem<Token>('currentUser')?.UserName` | `Session.UserEmail` | Nombre/email del usuario actual |
| `storage.GetSelectedCompany()` → `sessionStorage.SelectedCompany` | `CurrentCompany` | Objeto empresa seleccionada (`companyId`) |
| `storage.GetBannerVisibilityByUser()` → `localStorage.BannerUser` | `BannerUser` | Array de `{ currentUser, BannerVisibility, ExpiredDate }` |

---

## 3. Banner

### Fuente del dato
- Angular: `jsonDataService.GetJSONMessages()` → lee `assets/data/Banner.json`
- Banner.json shape:
```json
{ "Data": [{ "Visible": false, "ImgBanner": "/assets/banner_fe.png", "ViewUrl": "...", "Message": "..." }] }
```

### Lógica de visibilidad
```
1. Cargar Banner.json → banner.Data[0].Visible
2. Si Visible == true:
   a. Buscar en BannerUser (localStorage) el registro del usuario actual
   b. Si existe Y new Date(ExpiredDate) <= hoy → usar BannerUser.BannerVisibility
   c. Guardar en localStorage: SetBannerVisibilityByUser(user, Visible, today)
3. Mostrar/ocultar según `visibility`
```

### Acciones del banner
| Acción | Comportamiento |
|---|---|
| Click en imagen | `window.open(viewUrl, '_blank')` + `SetBannerVisibilityByUser(user, true, today)` |
| Click en X (close) | `visibility = false` + `SetBannerVisibilityByUser(user, true, today)` |

### `SetBannerVisibilityByUser` logic
```
- Lee BannerUser de localStorage (array)
- Calcula expirationDate = hoy + 1 día
- Si usuario ya existe en array: actualiza su entry
- Si no: agrega { currentUser, BannerVisibility, ExpiredDate: expirationDate }
- Guarda array en localStorage bajo 'BannerUser'
```

---

## 4. Gráficos (6 en total)

> **Nota:** El usuario indicó "sin gráficos de momento". Se implementan los contenedores con placeholders.

| Chart | Tipo | Título | API endpoint | Llave de datos |
|---|---|---|---|---|
| chart1 | line | Facturación últimos 30 días (CRC) | `GET /api/Documents/GetDocsPerDays?companyId=X` | `sumPerDay` / `last30Days` |
| chart2 | line | Facturación últimas 12 semanas (CRC) | `GET /api/Documents/GetDocsPerWeek?companyId=X` | `sumPerWeek` / `last12Weeks` |
| chart3 | line | Facturación últimos 12 meses (CRC) | `GET /api/Documents/GetDocsPerMonth?companyId=X` | `sumPerMonth` / `last12Months` |
| chart4 | bar | Top 10 clientes por venta últimos 3 meses (CRC) | `GET /api/Documents/GetTopTenCustomers?companyId=X` | `top10CustomersQty` / labels |
| chart5 | pie | Estado de envío de correos (últimos 30 días) | `GET /api/Documents/GetEmailsForChart?companyId=X` | `correoData` (Status/Quantity/Percent) |
| chart6 | pie | Cantidad de documentos por estado (últimos 30 días) | `GET /api/Documents/GetDocumentsForChart?companyId=X` | `documentsData` (Status/Quantity/Percent) |

### Visibilidad de contenedores
- chart1/2/3 se ocultan si `sumPerDay/Week/Month.length < 1`
- chart4 se oculta si `top10Customers.length < 1`
- chart5 se oculta si `correoData.length < 1`
- chart6 se oculta si `documentsData.length < 1`

### Colores chart5 (pie email)
| Status | Background | Border |
|---|---|---|
| Pendiente | rgba(255,0,0,0.2) | rgba(255,0,0,1) |
| Enviando | rgba(0,51,255,0.2) | rgba(0,51,255,1) |
| Error | rgba(223,255,0,0.2) | rgba(223,255,0,1) |
| Enviado | rgba(33,255,0,0.2) | rgba(33,255,0,1) |
| N/A | rgba(195,0,255,0.2) | rgba(195,0,255,1) |

### Colores chart6 (pie documentos)
| Status | Background | Border |
|---|---|---|
| Aceptado | rgba(33,255,0,0.2) | rgba(33,255,0,1) |
| Procesando | rgba(195,0,255,0.2) | rgba(195,0,255,1) |
| En Hacienda | rgba(223,255,0,0.2) | rgba(223,255,0,1) |
| Rechazado | rgba(0,51,255,0.2) | rgba(0,51,255,1) |
| Error | rgba(255,0,0,0.2) | rgba(255,0,0,1) |
| Reprocesar | rgba(255,0,123,0.2) | rgba(255,0,123,1) |
| Cancelado | rgba(255,80,0,0.2) | rgba(255,80,0,1) |
| N/A | rgba(0,255,221,0.2) | rgba(0,255,221,1) |

---

## 5. Lógica de cambio de empresa
Angular suscribe a `authenticationService.currentCompany` y destruye/recrea los 6 charts cuando cambia la empresa. En Rails, esto se manejará vía re-render cuando cambie `CurrentCompany` en localStorage (evento `storage`).

---

## 6. Llamada adicional al cargar
`globalFunctionsService.GetCertExpireDateAlarm(companyId)` — muestra un toast si el certificado está próximo a vencer. Se omite por ahora (lógica no migrada aún).

---

## 7. Matriz de funcionalidad

| Funcionalidad | Implementado en Rails | % Completo | Notas |
|---|---|---|---|
| Página /home con auth-guard | ✅ | 100% | |
| Menú lateral | ✅ | 100% | Vendor clavisco/menu |
| Banner (carga, show/hide) | ✅ | 100% | |
| Banner: cerrar y persistir en localStorage | ✅ | 100% | |
| Banner: click abre URL nueva pestaña | ✅ | 100% | |
| Contenedores de gráficos con títulos | ✅ | 100% | Placeholders sin Chart.js |
| Gráficos Chart.js (6) | ⏳ | 0% | Pendiente por instrucción del usuario |
| Cambio de empresa → reload charts | ⏳ | 0% | Pendiente junto con charts |
| GetCertExpireDateAlarm | ⏳ | 0% | No migrado aún |
