# Companies — Migración Completada

**Fecha:** 2026-06-04
**URL:** `http://localhost:3000/configurations/companies`

---

## ✅ Funcionalidad implementada (100%)

### Vista Index
- Formulario de búsqueda: Nombre Legal, Nombre Comercial, Identificación
- Botón "Consultar" — resetea página a 0 y recarga
- Botón "Crear" — visible solo con permiso `F_CreateCompany`
- Tabla con columnas: Nombre Legal, Nombre Comercial, Identificación, Compañía Favorita (★), Activa (badge)
- Badge de estado Activo/Inactivo (estilo Jira según CLAUDE.md)
- Estrella favorita amarilla en columna Favorita
- Botón "Establecer como Favorita" por fila → confirmación → POST `api/companies/{id}/favorite`
- Empresa sin asignaciones (QtyRolAssign=0) → toast info sin abrir confirmación
- Botón "Actualizar" por fila → navega a `/:id/edit` (requiere `F_ModifyCompany`)
- Paginación server-side: 5/10/15 por página, prev/next, info de rango
- Estados: loading skeleton, empty state, modal de error

### Vista Create (`/configurations/companies/new`)
- 6 secciones acordeón (`<details>`)
- **Datos Generales:** ComercialName, LegalName, Type (select), Identification (numeric con minlength/maxlength dinámico), CodigoActividad, NameToEmail, GroupId, ShortName, FreightCharges, Registrofiscal8707, SAPConnectionId, DBSap, IsExternal, Active
- **Adicional:** AdditionalInformation (textarea), EmailCC (array dinámico con + y -)
- **ATV:** CertPin (password + toggle), CertPath (file .p12/.pfx + download), CertExpireDate (readonly auto), TokenUsr, TokenPass (password + toggle)
- **Adjuntos:** Logo (jpg/jpeg/png), FEPrintFormat (.rpt) — ambos con file picker + download
- **Códigos de actividad:** OCULTO en create (solo visible en edit)
- **Factura Proveedor:** UseFactProv (habilita/deshabilita sapForm), SendReceptAndApInv, NumSerieProv, NumSerieFactProv, DefaultTaxForXML (select API), whDefault (select API), XmlToleranceAmounts (dinámico), XmlCurrencyMappings (dinámico)
- Botón "Registrar" al fondo — deshabilitado hasta form válido
- Validaciones: certificado/token vs identificación, minlength/maxlength por tipo

### Vista Edit (`/configurations/companies/:id/edit`)
- Carga paralela de 8 endpoints (forkJoin)
- Pre-popula todos los formularios con datos de la API
- EmailCC split por `;`
- Botones "Actualizar" individuales por sección:
  - action=1: Datos Generales
  - action=5: Adicional
  - action=2: Hacienda ATV
  - action=3: Adjuntos
  - SAP → action=4 + PUT currency-map
- **Códigos de actividad:** VISIBLE en edit, con add/remove y validación de duplicados
- Botón "Recargar información" → recarga warehouse/taxes/currencies desde SAP
- Botón "Restablecer formato" (con permiso `F_ResetCompanyFormat`) → modal confirmación
- "Registrar" OCULTO en modo edit

---

## ✅ Archivos creados/modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `config/routes.rb` | Modificado | 3 rutas: index, new, edit |
| `app/controllers/configurations/companies_controller.rb` | Nuevo | Controller con actions: index, new, edit |
| `app/views/configurations/companies/index.html.erb` | Nuevo | Vista de lista con búsqueda y paginación |
| `app/views/configurations/companies/new.html.erb` | Nuevo | Shell de creación |
| `app/views/configurations/companies/edit.html.erb` | Nuevo | Shell de edición |
| `app/views/configurations/companies/_form.html.erb` | Nuevo | Formulario compartido (6 secciones acordeón) |
| `app/javascript/controllers/companies_controller.js` | Nuevo | Stimulus: index (tabla + paginación + favorita) |
| `app/javascript/controllers/company_form_controller.js` | Nuevo | Stimulus: formulario create/edit |
| `app/javascript/controllers/index.js` | Modificado | Registro de los 2 controllers nuevos |
| `fec-migration-docs/comparisons/COMPANIES-COMPLETE-ANALYSIS.md` | Nuevo | Análisis exhaustivo del legacy Angular |
| `fec-ui-migration/tests/e2e/companies-complete-suite.spec.js` | Nuevo | 65 pruebas E2E (Playwright) |

---

## ✅ Pruebas creadas: 65

| Suite | Cantidad |
|---|---|
| Index — Carga inicial | 5 |
| Index — Permisos | 3 |
| Index — Tabla y badges | 6 |
| Index — Favorita | 4 |
| Index — Editar | 2 |
| Index — Paginación | 3 |
| Index — Manejo de errores | 2 |
| Create — Estructura | 8 |
| Create — Validaciones tipo identificación | 4 |
| Create — Toggle contraseña | 4 |
| Create — EmailCC dinámico | 4 |
| Create — Factura Proveedor | 6 |
| Create — Botón Registrar | 2 |
| Edit — Estructura | 9 |
| Edit — Guardar por sección | 2 |
| Edit — Validación ATV | 1 |
| **Total** | **65** |

> Las pruebas corren con mocks de API (no requieren servidor en vivo). Ejecutar con:
> ```bash
> cd fec-ui-migration && npx playwright test companies-complete-suite.spec.js --project=chromium
> ```

---

## 📋 Diferencias conocidas con Angular

| Diferencia | Motivo |
|---|---|
| Acordeón usa `<details>` nativo en vez de `mat-accordion` | Sin dependencia de Angular Material |
| Dialog "Crear conexión SAP" muestra toast placeholder | El componente `CreateOrUpdateConnectionComponent` se migrará en la tarea de Connections |
| Paginación sin botones numéricos intermedios | Solo prev/next para simplificar (equivalente funcional) |

---

## 📋 APIs proxied (sin cambios en backend)

Todas las llamadas API se enrutan a través del proxy Rails existente (`match '/api/*path'`).
