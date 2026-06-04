# USER-PROFILE — Migración Completa

**Fecha:** 2026-06-04  
**URL:** `http://localhost:3000/configurations/user-profile`  
**Angular origen:** `pages/configuration/users/update-user-info/`

---

## ✅ Funcionalidad implementada (100%)

- [x] Ruta Rails: `GET configurations/user-profile`
- [x] Controlador: `Configurations::UserProfileController#index`
- [x] Vista ERB con form completo (2 columnas responsive)
- [x] Stimulus controller `user-profile`
- [x] Carga inicial paralela: `GetUserInfo` + `GetGroupsByUser` + `GetCompanies`
- [x] Pre-relleno de `SapUser` desde datos del usuario
- [x] Campo `SapPass` vacío en carga, tipo `password`
- [x] Toggle visibilidad contraseña (`visibility` / `visibility_off`)
- [x] Select de compañías cargado desde API, pre-seleccionado desde storage
- [x] Select de compañías deshabilitado hasta que `credentialsDirty = true`
- [x] `credentialsDirty` tracking en cambios de `SapUser` o `SapPass`
- [x] Reset de `credentialsValidated` al cambiar compañía seleccionada
- [x] Botón "Probar credenciales" — 3 estados (default / validating / verified)
- [x] Validaciones en "Probar credenciales": compañía vacía, campos vacíos
- [x] POST `api/Connections/validate-user-credentials`
- [x] Animación CSS `verified-burst` en botón verificado
- [x] Campo `OCTypeControl` condicional (visible solo para compañías 186 y 1206)
- [x] Pre-selección de `DocNumberPreference` en OCTypeControl
- [x] Botón "Actualizar" deshabilitado si `form.invalid` o `credentialsDirty && !credentialsValidated`
- [x] PATCH `api/User/profile-info` con payload completo del usuario
- [x] `DocNumberPreference` enviado como string (`.toString()`)
- [x] Toast success en actualización exitosa
- [x] Toast / modal error en fallos
- [x] Reload de datos post-actualización (`#onLoad()`)

---

## ✅ Pruebas creadas

**Archivo:** `fec-ui-migration/tests/e2e/user-profile-complete-suite.spec.js`  
**Total de pruebas:** 30

| Suite | Tests |
|---|---|
| Carga inicial | 10 |
| Toggle visibilidad contraseña | 2 |
| credentialsDirty tracking | 4 |
| Probar credenciales | 6 |
| Botón Actualizar — habilitación | 4 |
| Flujo de actualización | 5 |
| OCTypeControl | 2 |
| Error en carga inicial | 1 |

**Nota:** Las pruebas requieren servidor Rails en ejecución (`http://localhost:3000`). Ejecutar con:
```bash
cd fec-ui-migration
npx playwright test user-profile-complete-suite.spec.js --project=chromium
```

---

## 📁 Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `app/controllers/configurations/user_profile_controller.rb` | Creado |
| `app/views/configurations/user_profile/index.html.erb` | Creado |
| `app/javascript/controllers/user_profile_controller.js` | Creado |
| `app/javascript/controllers/index.js` | Modificado — registro del controller |
| `config/routes.rb` | Modificado — ruta `user-profile` |
| `app/assets/stylesheets/application.css` | Modificado — CSS `btn-verified` |
| `fec-ui-migration/tests/e2e/user-profile-complete-suite.spec.js` | Creado |
| `fec-migration-docs/comparisons/USER-PROFILE-COMPLETE-ANALYSIS.md` | Creado |

---

## 📋 Diferencias conocidas con Angular

- Angular usaba `forkJoin` con overlay spinner; Rails usa `Promise.all` con estado interno — funcionalmente equivalente.
- El toast en Angular usaba `@clavisco/alerts`; en Rails se implementó un toast custom nativo con los mismos parámetros (posición, tipo, darkMode).
- Los errores modales (`modalService.Continue`) se replicaron con un modal inline propio.
- `GetGroupsByUser` se llama igual que en Angular pero los grupos no se renderizan en UI (tampoco en Angular — solo se cargaban en `groupsList`).

---

## Validación estática realizada

- ✅ Sintaxis Ruby: `routes.rb` y `user_profile_controller.rb` — OK
- ✅ `data-testid` en ERB vs spec: 14/14 coinciden al 100%
- ✅ Stimulus targets: 19 declarados, 19 presentes en ERB, todos referenciados en JS
- ✅ JS sin errores de sintaxis detectables por `node --check`
