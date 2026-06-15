# MIGRACIÓN COMPLETA — documents/receptions/:id/create

**Fecha:** 2026-06-09  
**Módulo Angular original:** `CreateApinvoiceComponent` (`src/app/pages/documents/create-apinvoice/`)

---

## ✅ Funcionalidad implementada

### Ruta y controller
- Ruta: `GET /documents/receptions/:id/create` → `Documents::ReceptionsController#create`
- Layout: `protected` (menú + toolbar + auth-guard)
- `docId` disponible en el controller desde `params[:id]`

### Acordeón "Recepción de Documentos"
- Visible solo cuando `sessionStorage.shouldRecept === 'true'`
- Pre-relleno desde `GET /api/Documents/GetDocumentInfoPreview?documentId={id}`
- Campos: Mensaje, CondicionImpuesto, TaxFactor, CodigoActividad, DetalleMensaje
- TaxFactor se habilita automáticamente cuando CondicionImpuesto = 03 o 05
- DetalleMensaje requerido cuando Mensaje = 2 o 3
- Botón Previsualizar → panel lateral con datos del documento

### Tab Cabecera
- Pre-relleno completo desde `xmlDoc` (DocDate, TaxDate, CardName, NumAtCard, Comments, DocCur)
- PatchSupplier desde LicTradNum del XML → modal de advertencia si no existe
- Autocomplete de proveedores (filtro client-side sobre `GET /api/BusinessPartners`)
- Autocomplete de documento base con debounce 260ms (`GET /api/Documents/sap`)
  - Auto-selección si hay exactamente 1 resultado
- Checkbox "Cerrar documento de referencia" (habilitado solo cuando hay doc seleccionado)
- DocDueDate calculado: TaxDate + ExtraDays del proveedor
- Botones Hoy en campos de fecha
- UDFs dinámicos (text/select) renderizados desde `GET /api/Udf/GetConfiguredUdfs`
- Tabla de líneas de factura (read-only, actualizada desde tab Líneas)
- Totales: SubTotal, Otros Cargos, Impuestos, Descuento, Total
- Textarea Comentario con contador N/254
- Botones "Crear borrador en SAP" y "Crear en SAP" (disabled hasta CardCode válido)

### Tab Líneas
- Visible solo cuando Cabecera tiene CardCode válido
- Tabla XML con columnas: Código, Detalle, Cantidad, Precio, Descuento, Impuesto, Monto, Disponible, Agregar
- Modal de selección de ítem: artículo SAP, almacén, cantidad, cuenta, proyecto
- Tabla de líneas a SAP con edición inline (detalle, cuenta, proyecto, impuesto)
- Dropdown de impuestos, cuentas, proyectos por línea
- Botón eliminar línea (restituye disponible en tabla XML)
- Al cambiar a tab Líneas: bloquea CardCode
- **Match automático** (paridad con `LinesComponent.AddAutomaticLines`):
  - Flag puente estático `public/CompanyUseMatchAuto.json` (`UseMatchAuto`), leído por `#loadMatchAutoFlag()`
  - Al abrir el tab Líneas por primera vez (`switchTab`, guard `#matchAutoRan`) se ejecuta `#addAutomaticLines()`
  - `POST /api/Documents/MatchAutomatic` → agrega las líneas ya mapeadas (item, cuenta por `FormatCode`, dimensiones, impuesto, totales) y deja la línea XML en Disponible 0
  - Cubierto por la suite E2E «Match automático de líneas» (6 pruebas)
- **Selección múltiple en las tablas** (patrón de Otros Cargos):
  - Tablas XML (pendientes) y SAP (agregadas) con columna `rowSelection`
  - Multi-agregar: marcar varias líneas XML pendientes → panel único con artículo/almacén/cuenta/proyecto/impuesto comunes; cantidad = Disponible de cada línea (campo Cantidad oculto en multi); se agregan todas juntas (`#openItemSelectionForLines`)
  - Multi-eliminar: marcar varias líneas SAP → se eliminan juntas
- **Confirmación de borrado** (`confirm` del alerts service, tipo warning): toda eliminación (1 o varias filas) en las tablas SAP, Otros Cargos (líneas) y Otros Cargos (cargos) pide confirmación con mensaje según la cantidad (`#confirmDelete`). Reemplaza el borrado directo anterior.
  - Cubierto por la suite E2E «Selección múltiple y eliminación» (7 pruebas)

### Tab Otros Cargos
- Visible cuando `xmlDoc2.DocChargesXMLLines.length > 0`
- Tabla con cargos adicionales del XML

### Validaciones de creación
- Verificación `docTypeXML === 1 (Factura)`
- Validación de UDFs requeridos
- Validación de tolerancia de montos vs XML
  - Modal de selección de tolerancia si la moneda no tiene configuración
- Validación del formulario de recepción (si aplica)

### Modal de moneda mismatch
- Se muestra cuando `xmlDoc.DocCur` no está en `companyCurrencies`
- Permite seleccionar moneda alternativa
- Opción de guardar mapeo → `POST /api/Companies/{id}/currency-map`

### Flujos de creación
- **Solo factura:** `POST /api/documents/ap-invoices`
- **Recepción + factura:** `POST /api/documents/ap-invoices-with-recept` (cuando `SendReceptAndApInv && shouldRecept`)
- Modal de éxito → navega a `/documents/receptions` (o `/documents/gt/receptions` si `urlToReturnType` en query)
- Modal de error/advertencia para errores de API

### Carga de datos paralela
10 llamadas en paralelo al cargar: accounts, docXML, docCharges, taxes, items, company, dimensions, warehouses, projects, currencies.

---

## 📁 Archivos creados / modificados

| Archivo | Acción |
|---------|--------|
| `config/routes.rb` | Agregada ruta `get 'receptions/:id/create'` |
| `app/controllers/documents/receptions_controller.rb` | Agregada action `def create; end` |
| `app/views/documents/receptions/create.html.erb` | Creado (nueva vista) |
| `app/javascript/controllers/documents_reception_create_controller.js` | Creado (nuevo Stimulus controller) |
| `app/javascript/controllers/index.js` | Import + register del nuevo controller |
| `fec-migration-docs/comparisons/RECEPTIONS-CREATE-COMPLETE-ANALYSIS.md` | Creado (análisis) |
| `fec-ui-migration/tests/e2e/receptions-create-complete-suite.spec.js` | Creado (pruebas E2E) |

---

## 📋 Diferencias conocidas con Angular

| Aspecto | Angular | Rails |
|---------|---------|-------|
| Match automático | `GET /assets/data/CompanyUseMatchAuto.json` + `POST /api/Documents/MatchAutomatic` | Solo UI para agregar manualmente; botón automático pendiente |
| Tabla @clavisco/table | Componente con CL_CHANNEL linker, drag&drop | Tablas HTML nativas con editing inline |
| Modal de dimensiones | MatDialog completo con 5 dimensiones | `openOtrosCargosSelection` es stub — pendiente |
| Líneas de Otros Cargos | Flujo completo equivalente a Líneas | UI básica, sin modal de selección completa |

---

## ⚠️ Pendiente para iteración siguiente
1. **Match automático de líneas** — botón que llama `POST /api/Documents/MatchAutomatic`
2. **Modal de dimensiones** por línea (5 dimensiones, centro de costo)
3. **Tab Otros Cargos** — modal de selección completo equivalente al de Líneas
4. Pruebas E2E — requieren servidor Rails corriendo en `localhost:3000`
