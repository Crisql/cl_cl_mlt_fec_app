# PROTOCOLO DE MIGRACIÓN AUTOMÁTICA

## ACTIVACIÓN DEL PROTOCOLO

Cuando el usuario diga: **"migrate [URL]"** (sin slash), ejecutar automáticamente el proceso completo de 6 fases.

**Ejemplos que activan el protocolo:**
- "migrate http://localhost:3000/master-data/business-partners"
- "migrate http://localhost:3000/sales/invoices"
- "migra http://localhost:3000/master-data/items"

## PROCESO COMPLETO (EJECUTAR AUTOMÁTICAMENTE)

### FASE 0: IDENTIFICAR MÓDULO DESDE URL

1. **Parsear URL**
   - De `http://localhost:3000/master-data/business-partners` extraer:
     - Namespace: `master-data` → `MasterData`
     - Módulo: `business-partners` → `business_partners` (Rails) / `business-partners` (Angular)

2. **Localizar archivos Rails**
   ```
   Controlador: app/controllers/master_data/business_partners_controller.rb
   Vista: app/views/master_data/business_partners/index.html.erb
   JS Controller: app/javascript/controllers/business_partners_controller.js
   ```

3. **Localizar componente Angular**
   ```
   Path: legacy/web_angular/src/app/components/master-data/business-partners/
   ```

4. **Si hay ambigüedad → PREGUNTAR**
   - Detener proceso
   - Preguntar al usuario por clarificación
   - NO asumir qué módulo es

### FASE 1: ANÁLISIS EXHAUSTIVO DE LEGACY

1. **Leer TODO el código Angular del módulo**
   - Componente .ts, .html, .scss
   - Servicios relacionados
   - Modales/dialogs que abre
   - Componentes vendor (@clavisco/*)

2. **Documentar TODA la funcionalidad**
   - Crear: `/fec-migration-docs/comparisons/[MODULE]-COMPLETE-ANALYSIS.md`
   - Incluir:
     - Estructura de la página (tabs, secciones, modales)
     - Lista COMPLETA de campos (tipo, validaciones, defaults)
     - Lista de TODOS los botones (qué hacen, cuándo están habilitados)
     - Todos los event listeners (onChange, onBlur, onClick, onKeydown, etc.)
     - Todas las llamadas API (GET/POST/PATCH/DELETE con parámetros)
     - Lógica de negocio (change detection, validaciones, cálculos)
     - Flujos de usuario completos (crear, actualizar, buscar, eliminar)
     - Componentes vendor usados (configuración completa)
     - Edge cases y validaciones
   - Crear matriz de funcionalidad:
     | Funcionalidad | Implementado en Rails | % Completo | Notas |

### FASE 2: GENERACIÓN DE PRUEBAS E2E

1. **Crear suite completa**
   - Archivo: `/fec-ui-migration/tests/e2e/[module]-complete-suite.spec.js`

2. **Incluir pruebas para:**
   - Carga inicial (página carga, campos con valores correctos, botones correctos)
   - Cada campo individual (llenar, validar, onChange)
   - Cada botón (click, resultado, estado deshabilitado cuando corresponde)
   - Cada flujo completo (crear, buscar, actualizar, tabs, modales)
   - Edge cases (campos vacíos, API errors, cambios sin guardar)
   - Interacciones complejas (teclado, focus, selección)

3. **Estructura de pruebas**
   ```javascript
   describe('Módulo X - [Sección]', () => {
     test('Descripción clara', async ({ page }) => {
       // 1. Setup
       // 2. Action
       // 3. Assert
       // 4. Cleanup
     })
   })
   ```

### FASE 3: IMPLEMENTACIÓN EN RAILS

1. **Verificar implementación actual**
   - Leer controlador Stimulus
   - Leer vista ERB
   - Identificar gaps

2. **Implementar funcionalidad faltante** (en orden):
   - Estructura básica (HTML con TODOS los campos y botones)
   - Lógica de negocio (métodos, validaciones, change detection)
   - Componentes vendor (configuración correcta)
   - Llamadas API (con headers y parámetros correctos)
   - Event handlers (onChange, onBlur, onClick, onKeydown, etc.)

3. **Documentar cambios**
   - Commit con mensaje descriptivo

### FASE 4: VALIDACIÓN CON PRUEBAS

1. **Ejecutar suite completa**
   ```bash
   npx playwright test [module]-complete-suite.spec.js --project=chromium
   ```

2. **Analizar resultados**
   - Si TODAS pasan → IR A FASE 6
   - Si ALGUNA falla → IR A FASE 5

### FASE 5: CORRECCIÓN Y RE-VALIDACIÓN (LOOP)

1. **Analizar cada fallo**
   - Leer error de Playwright
   - Leer screenshot/trace
   - Identificar causa raíz

2. **Comparar con Angular legacy**
   - Verificar exactamente cómo funciona en Angular
   - **NO ASUMIR**, leer el código

3. **Corregir**
   - Aplicar fix
   - Documentar qué se corrigió

4. **Re-ejecutar pruebas**
   ```bash
   npx playwright test [module]-complete-suite.spec.js --project=chromium
   ```

5. **Repetir hasta que TODO pase**

### FASE 6: DOCUMENTACIÓN FINAL

1. **Crear resumen de migración**
   - Archivo: `/fec-migration-docs/progress/[MODULE]-MIGRATION-COMPLETE.md`
   - Incluir:
     - ✅ Lista de funcionalidad implementada (100%)
     - ✅ Pruebas creadas (cantidad)
     - ✅ Pruebas pasando (todas)
     - 📋 Diferencias conocidas con Angular (si las hay)
     - 📋 Limitaciones (si las hay)

2. **Hacer commit del módulo migrado**
   ```bash
   git add .
   git commit -m "migrate: [module] — Angular → Rails

   - Controller: app/controllers/[path]_controller.rb
   - Vista: app/views/[path]/index.html.erb
   - Stimulus: app/javascript/controllers/[name]_controller.js
   - Tests: fec-ui-migration/tests/e2e/[module]-complete-suite.spec.js
   - Docs: fec-migration-docs/comparisons/[MODULE]-COMPLETE-ANALYSIS.md"
   ```

3. **Reportar al usuario**
   ```
   ✅ [Módulo] migrado completamente

   📊 Resultados:
   - Funcionalidad: 100% (X/X features)
   - Pruebas: X/X pasando ✅
   - Tiempo: X minutos

   📁 Documentación:
   - Análisis: [ruta]
   - Pruebas: [ruta]
   - Resumen: [ruta]
   ```

## REGLAS OBLIGATORIAS

1. **NUNCA asumir funcionalidad** → Siempre verificar en Angular legacy PRIMERO
2. **NUNCA saltarse pruebas** → Son obligatorias en TODA migración
3. **NUNCA decir "está listo" sin pruebas pasando al 100%**
4. **SIEMPRE leer TODO el código Angular** → No solo lo relevante
5. **SIEMPRE documentar cada fase**
6. **NUNCA inventar funcionalidad** → Solo replicar lo que existe
7. **SIEMPRE preguntar si hay ambigüedad** → No asumir
8. **SIEMPRE utilizar buenas practicas**
9. **SIEMPRE aplicar Clean Code**

## CHECKLIST ANTES DE REPORTAR "COMPLETO"

- [ ] Leí COMPLETO el código Angular del módulo
- [ ] Documenté TODA la funcionalidad en COMPLETE-ANALYSIS
- [ ] Creé suite de pruebas que cubra TODA la funcionalidad
- [ ] Implementé TODA la funcionalidad faltante en Rails
- [ ] Ejecuté pruebas y TODAS pasan (100%)
- [ ] Documenté la migración en MIGRATION-COMPLETE
- [ ] Revisé que NO haya funcionalidad inventada

## USO

**Usuario dice:**
```
migrate http://localhost:3000/master-data/business-partners
```

**Claude ejecuta automáticamente las 6 fases SIN que el usuario tenga que repetir:**
- "Revisa contra legacy"
- "Agrega pruebas"
- "Valida que funcione"
- "No asumas, verifica"

---

## PATRONES OBLIGATORIOS — STORAGE Y AUTH

### ⚠️ LEER ANTES DE ESCRIBIR CUALQUIER STIMULUS CONTROLLER

Referencia completa: `fec-migration-docs/STORAGE-KEY-MAPPING.md`

#### Storage keys correctas

| Dato | Helper | Key | Tipo |
|---|---|---|---|
| Token de sesión | `Storage.get('Session')` | `localStorage.Session` | `{ access_token, expires_at, UserEmail, UserId }` |
| Empresa activa | `SStore.get('CurrentCompany')` | `sessionStorage.CurrentCompany` | `{ companyId, companyName, groupId, ... }` |
| Permisos | `SStore.get('Permissions')` | `sessionStorage.Permissions` | `string[]` — e.g. `["F_CreateCompany", "S_Company"]` |

#### ❌ Keys que NO existen en Rails

- `SStore.get('UserPermissions')` — NO existe, es `Permissions`
- `SStore.get('CurrentSession')` — NO existe, es `Storage.get('Session')`
- `SStore.get('CurrentFESession')` — NO existe en Rails (Angular legacy). Pasar `feToken=''`.

#### Patrón `#hasPerm` correcto

```js
// ✅ CORRECTO — Permissions es string[]
#hasPerm(name) { return this.#permissions.includes(name); }

// ❌ INCORRECTO — era el formato Angular (objetos con .Name)
#hasPerm(name) { return this.#permissions.some(p => p.Name === name); }
```

#### Patrón `#apiFetch` correcto (copiar de roles_controller.js)

```js
async #apiFetch(url, options = {}) {
  const session = Storage.get('Session') || {};
  const token   = session.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':             'application/json',
      'API':                      'ApiAppUrl',
      'X-Skip-Error-Interceptor': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}
```

#### Patrón en tests E2E (injectAuth)

```js
// Permissions es array de STRINGS (no objetos)
const MOCK_PERMISSIONS = ['F_CreateCompany', 'F_ModifyCompany']

async function injectAuth(page, perms = MOCK_PERMISSIONS) {
  await page.goto(LOGIN_URL)
  await page.evaluate(({ session, company, permissions }) => {
    localStorage.setItem('Session',          JSON.stringify(session))
    sessionStorage.setItem('CurrentCompany', JSON.stringify(company))
    sessionStorage.setItem('Permissions',    JSON.stringify(permissions))
  }, { session: MOCK_SESSION, company: MOCK_COMPANY, permissions: perms })
}
```

---

## REGLA ADICIONAL

10. **SIEMPRE leer `fec-migration-docs/STORAGE-KEY-MAPPING.md` antes de implementar cualquier controller** — las keys de storage difieren del legacy Angular.
