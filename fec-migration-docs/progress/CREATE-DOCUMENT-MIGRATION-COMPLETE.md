# Create Document — Resumen de Migración (Angular → Rails)

> Ruta legacy: `/createDocument/:docType` → Ruta Rails: **`/documents/:type/create`**
> Tipos soportados: FE `01`, ND `02`, NC `03`, FEC `08`, REP `10`
> Análisis fuente: `fec-migration-docs/comparisons/CREATE-DOCUMENT-COMPLETE-ANALYSIS.md`

---

## Archivos creados / modificados

### Creados
| Archivo | Propósito |
|---|---|
| `app/controllers/documents/create_controller.rb` | Controller Rails, `layout 'protected'`, valida `type` ∈ {01,02,03,08,10} |
| `app/views/documents/create/index.html.erb` | Vista principal: toolbar, acordeón 7 secciones, pie de totales |
| `app/views/documents/create/_section.html.erb` | Partial de panel de acordeón reutilizable |
| `app/views/documents/create/_panels.html.erb` | Paneles laterales: búsqueda de cliente + agregar/editar ítem |
| `app/views/documents/create/_modals.html.erb` | Modales: Terminal/Sucursal, confirmación, éxito/advertencia/error, overlay carga |
| `app/javascript/controllers/documents_create_controller.js` | Stimulus controller (~1300 líneas) con toda la lógica |
| `app/javascript/controllers/create_document_constants.js` | Constantes de dominio portadas de `models/constants.ts` + `enums.ts` |
| `fec-ui-migration/tests/e2e/create-document-complete-suite.spec.js` | Suite E2E Playwright (22 pruebas) |
| `public/ImpuestoType.json`, `public/UnidadMedidaTypeProducto.json`, `public/UnidadMedidaTypeServicio.json` | Catálogos estáticos (copiados del legacy) |

### Modificados
| Archivo | Cambio |
|---|---|
| `config/routes.rb` | Nueva ruta `get ':type/create'` en `namespace :documents` con constraint de tipo |
| `app/javascript/controllers/menu_controller.js` | Rutas del menú `/createDocument/0X` → `/documents/0X/create` (5 entradas) |
| `app/javascript/controllers/index.js` | Registro de `documents-create` controller |
| `config/initializers/proxy.rb` | Nuevo `api_cabys_url` (búsqueda CABYS de Hacienda) |
| `app/controllers/proxy_controller.rb` | Routing de header `API: ApiCabysURL` + manejo de path `/api/Cabys` |
| `.env.example` | Variable `API_CABYS_URL` |

---

## Funcionalidad implementada

| Funcionalidad | Estado | Notas |
|---|---|---|
| Routing por docType + redirect si tipo inválido | ✅ | constraint en `routes.rb` |
| Actualización de opciones de menú | ✅ | 5 entradas |
| Acordeón de 7 secciones + colapsar | ✅ | partial `_section` |
| Ramificación `SetDocTypeString` por docType | ✅ | incluye **trampa ND/NC** (02=Débito, 03=Crédito) replicada fielmente |
| Datos generales (fecha, condición venta, moneda, tipo cambio, plazo, actividad) | ✅ | CRC fija tipo cambio en 1 |
| Reglas de identificación (min/max por tipo 01-06) | ✅ | habilita Otras Señas Extranjero en `05` |
| `ValidateCustomerType` (combinaciones bloqueadas) | ✅ | |
| Búsqueda de cliente (panel lateral) | ✅ | `GET /api/Customer`, columna 8707 solo FEC |
| Cascada de ubicación Provincia→Cantón→Distrito→Barrio | ✅ | desde `Country.json` |
| Datos de contacto: email simple + multi-email FEC (1-4) | ✅ | concatena válidos con `;` |
| Referencias (FormArray 1-10) + confirmación al eliminar | ✅ | reglas required por docType |
| Ítems: panel agregar/editar/eliminar + tabla | ✅ | |
| Cálculo de línea (subtotal, descuento, impuesto, regalía) | ✅ | regalía: subtotal 0, total = impuesto |
| Búsqueda CABYS (Hacienda) | ✅ | vía proxy `ApiCabysURL` (nuevo) |
| Medios de pago (FormArray 1-4) + suma == total | ✅ | |
| Terminal/Sucursal (modal) | ✅ | `GET GetTerminalSucursal`, redirige a numeración si vacío |
| Totales de documento (pie) | ✅ | |
| Submit `POST CreateDocumentManual` (**ApiFEUrl**) | ✅ | header API correcto |
| Manejo respuesta Hacienda (éxito / advertencia+Reenviar / error) | ✅ | modales + estado botón |
| Validación precio cero sin impuesto | ✅ | toast info, aborta |
| Validación Terminal/Sucursal = 0 | ✅ | abre modal |
| Catálogos JSON locales servidos como assets | ✅ | `public/*.json` |

### Diferencias / limitaciones conocidas vs Angular

1. **Ítems compuestos ("surtidos", hasta 20 sub-líneas CABYS por ítem):** no portados en esta primera versión. El `add-item` legacy (2664 líneas) incluye un sub-formulario de surtidos con cálculo agregado de impuesto. La migración cubre el flujo de ítem simple (producto/servicio con un CABYS). **Pendiente** como fase siguiente.
2. **Tipos de impuesto avanzados volumétricos** (alcohol `04`, bebidas/jabón `05`, tabaco `06`, combustible `03` con cantidad/volumen de unidad): el panel calcula IVA/selectivo/otros por tarifa porcentual. Los impuestos específicos por unidad/volumen quedan **pendientes**.
3. **Exoneración** del ítem: la estructura de datos está contemplada en el mapeo, pero el sub-formulario de exoneración (tipo documento, institución, tarifa exonerada, monto) **no** se expone aún en el panel. Pendiente.
4. **Mapeo FEC Rcpr*→Emsr* en el body del POST:** el backend legacy reasigna campos para FEC. El payload Rails envía los campos `Rcpr*` y `EmsrRegistrofiscal8707`; conviene **verificar contra el backend** que el server de Sync hace el mapeo, o ajustar `#buildPayload` si el contrato exige nombres `Emsr*` explícitos.

---

## Pruebas

Suite: `fec-ui-migration/tests/e2e/create-document-complete-suite.spec.js` — **22 pruebas** que cubren:
carga inicial por los 5 docTypes (incl. trampa de títulos ND/NC), visibilidad de secciones (FEC emisor + 8707, REP sin ubicación), moneda/tipo de cambio, búsqueda y selección de cliente, alta/edición/eliminación de ítems con recálculo de totales, referencias, medios de pago (máx 4), terminal/sucursal, envío (éxito, advertencia+Reenviar, sin ítems) y colapsar acordeón.

### Estado de ejecución

| Verificación | Resultado |
|---|---|
| Sintaxis Ruby (`ruby -c`) de controller/routes/proxy/initializer | ✅ OK |
| Sintaxis JS (`node --check`) controller + constantes + spec | ✅ OK |
| Registro Stimulus en `index.js` | ✅ verificado |
| Targets/acciones/test-ids cruzados vista↔controller↔spec | ✅ sin huérfanos |
| Playwright `--list` (22 tests reconocidos) | ✅ OK |
| **Ejecución E2E en vivo (`npx playwright test`)** | ⏳ **PENDIENTE** — requiere `bin/dev` con Ruby 3.3 + backend dev accesible |

> ⚠️ **Importante (honestidad de estado):** la ejecución en vivo de la suite **no** se pudo correr en el entorno de trabajo (Ruby 3.0.2 sin gems; la app requiere 3.3.0 + servidor en :3000). Toda la validación estática pasa. Para cerrar Fase 4-5 del protocolo, ejecutar en el entorno de desarrollo:
> ```bash
> bin/dev   # en una terminal
> cd fec-ui-migration && npx playwright test create-document-complete-suite.spec.js --project=chromium
> ```
> y corregir cualquier fallo contra el comportamiento del Angular legacy.

---

## Checklist del protocolo

- [x] Leí COMPLETO el código Angular del módulo (.ts/.html/.scss + add-item + term-suc-modal + servicios + enums/constants)
- [x] Documenté TODA la funcionalidad en `CREATE-DOCUMENT-COMPLETE-ANALYSIS.md`
- [x] Creé suite de pruebas E2E que cubre la funcionalidad principal (22 pruebas)
- [x] Implementé la funcionalidad en Rails (controller, vista, Stimulus, ruta, menú, proxy CABYS)
- [ ] Ejecuté pruebas y TODAS pasan (100%) — **pendiente de ejecución en entorno dev**
- [x] Documenté la migración en este archivo
- [x] No se inventó funcionalidad — todo deriva del análisis del legacy; surtidos/exoneración/impuestos volumétricos marcados explícitamente como pendientes
