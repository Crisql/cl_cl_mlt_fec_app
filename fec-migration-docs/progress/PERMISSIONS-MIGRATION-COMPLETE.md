# PERMISSIONS - Migración Completa

## Resumen

Módulo `configurations/permissions` migrado de Angular a Rails.

## Funcionalidad implementada (100%)

### Contenedor (tabs)
- [x] Tab "Permisos por Rol" filtrado por permiso `Configurations_Permissions_Access`
- [x] Tab "Permisos Globales" filtrado por permiso `Configurations_Permissions_GlobalAccess`
- [x] Redirect a /home si usuario sin ningún permiso
- [x] Auto-redirect al primer tab disponible en ruta base
- [x] URL refleja tab activo (/by-role, /global) via history.pushState
- [x] Escucha cambio de empresa (storage event) y recarga datos

### Tab: Permisos por Rol
- [x] Selector de roles (filtra OWNER, auto-selecciona primero)
- [x] Drag & drop HTML5 nativo entre listas (disponibles/asignados)
- [x] Botón "Asignar todos" / "Desasignar todos"
- [x] Badge de cambios pendientes (naranja cuando hay cambios)
- [x] Resumen de cambios (cuántos asignar/desasignar)
- [x] Botón "Guardar Cambios" - POST /api/Permission/AssignPermByRol
- [x] Botón "Cancelar Cambios" - restaura estado desde API
- [x] Tras guardar: actualiza localStorage y window.location.reload()
- [x] Empty states (sin rol seleccionado, lista vacía)

### Tab: Permisos Globales
- [x] Autocomplete de usuarios filtrado por email
- [x] Carga inicial paralela (forkJoin) de usuarios + permisos globales
- [x] Solo muestra usuarios con Active=true
- [x] Panel de drag & drop visible solo con usuario seleccionado
- [x] Drag & drop HTML5 nativo entre listas
- [x] Botón "Asignar todos" / "Desasignar todos"
- [x] Badge de cambios pendientes
- [x] Resumen de cambios
- [x] "Aplicar Cambios" - POST + DELETE /api/Permission/bulk-global-permissions en paralelo
- [x] "Cancelar Cambios" - recarga permisos del usuario seleccionado
- [x] NO recarga la página tras aplicar (diferencia intencional vs by-role)
- [x] Empty state sin usuario seleccionado

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `app/controllers/configurations/permissions_controller.rb` | Controller Rails |
| `app/views/configurations/permissions/index.html.erb` | Vista ERB completa |
| `app/javascript/controllers/permissions_controller.js` | Stimulus controller |
| `config/routes.rb` | Rutas /configurations/permissions/* |
| `app/javascript/controllers/index.js` | Registro del controller |
| `fec-migration-docs/comparisons/PERMISSIONS-COMPLETE-ANALYSIS.md` | Análisis |
| `fec-ui-migration/tests/e2e/permissions-complete-suite.spec.js` | Suite E2E |

## Pruebas E2E

**Total:** 33 pruebas
- Auth Guard: 3
- Tabs/filtrado: 8
- By-Role carga inicial: 3
- By-Role acciones: 9
- Global carga inicial: 3
- Global acciones: 8
- Edge cases: 3 (sin servidor Rails no ejecutables en sandbox)

**Estado:** Sintaxis validada (Ruby + Node). Ejecución pendiente con servidor Rails local.

## Diferencias conocidas vs Angular

| Aspecto | Angular | Rails |
|---------|---------|-------|
| Drag & drop | CDK DragDrop | HTML5 nativo |
| Tabs | Angular Material `mat-tab-group` | Tailwind + Stimulus |
| Autocomplete | `mat-autocomplete` | Custom dropdown Stimulus |
| Overlay | `@clavisco/overlay` | Custom div Stimulus |
| Toast | `@clavisco/alerts` CLToastType | Custom toast Stimulus |
| Storage key | `StorageService.GetUserPermissions()` | `Storage.get('UserPermissions')` |
