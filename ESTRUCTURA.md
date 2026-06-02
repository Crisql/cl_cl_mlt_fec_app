# Estructura de Proyecto — Rails 8 + Hotwire + Proxy API

Referencia de arquitectura y convenciones para proyectos Rails con este patrón.
**Ruby · Rails 8 · Hotwire (Turbo + Stimulus) · Tailwind CSS**

---

## Concepto clave: Proxy puro

Rails NO almacena datos de negocio. Todo dato viene de un API externo.
Rails hace: enrutar → renderizar vista ERB → Stimulus toma el control → proxy reenvía llamadas al API.

```
Browser → Rails (rutas + vistas ERB) → Stimulus Controllers → /api/* → ProxyController → API externo
```

La autenticación es **100% client-side**: token en `localStorage`, el proxy lo reenvía como header.

---

## Árbol de directorios

```
proyecto/
├── app/
│   ├── controllers/          # Controllers organizados por módulo (namespace)
│   ├── javascript/
│   │   ├── controllers/      # Stimulus controllers (uno por vista/funcionalidad)
│   │   └── vendor/           # Librerías JS propias o de terceros copiadas localmente
│   ├── views/                # Plantillas ERB (una por controller/acción)
│   ├── assets/               # CSS compilado (Tailwind)
│   └── models/               # Solo ApplicationRecord si no hay persistencia de negocio
├── config/
│   ├── routes.rb             # Todas las rutas del proyecto
│   ├── database.yml          # Configuración de base de datos por ambiente
│   └── initializers/         # Configuración de gems y setup inicial
├── db/                       # Migraciones y schema (mínimo si solo hay infra)
├── tests/
│   ├── e2e/                  # Tests end-to-end (Playwright)
│   └── helpers/              # Helpers reutilizables para tests
└── docs/                     # Documentación interna del proyecto
```

---

## Dónde va cada cosa nueva

### Un nuevo módulo o funcionalidad

1. **Controller** → `app/controllers/<módulo>/<nombre>_controller.rb`
2. **Vista** → `app/views/<módulo>/<nombre>/index.html.erb`
3. **Ruta** → `config/routes.rb` dentro del namespace correspondiente
4. **Stimulus JS** → `app/javascript/controllers/<módulo>_<nombre>_controller.js`
5. **Registrar Stimulus** → `app/javascript/controllers/index.js`

### Un nuevo componente JS reutilizable

```
app/javascript/vendor/<nombre-componente>/
├── index.js          # Entry point del componente
└── [otros archivos]
```

Luego importarlo en el Stimulus controller que lo necesite.

### Una nueva ruta de API (proxy)

No se toca Rails. El proxy captura todo bajo `/api/*` y lo reenvía automáticamente.
El frontend solo necesita llamar a `/api/<endpoint>`.

### Lógica de autenticación

- El token vive en `localStorage`
- Un Stimulus controller actúa como guard y verifica auth en cada página
- El controller Rails de sesión solo renderiza la vista de login
- El proxy toma el token del header y lo reenvía al API externo

### Un test E2E nuevo

→ `tests/e2e/<número>-<descripción>.spec.js`
Reutilizar helpers existentes en `tests/helpers/` para autenticación y acciones comunes.

---

## Convención de nombres Stimulus

El nombre del archivo determina el `data-controller` en el HTML. Rails conecta automáticamente:

| Archivo JS | `data-controller` en HTML |
|---|---|
| `sales_document_controller.js` | `sales-document` |
| `maintenance_users_controller.js` | `maintenance-users` |
| `login_controller.js` | `login` |

Romper esta convención significa que Stimulus no encuentra el controller.

---

## Base de datos

En proyectos proxy, el schema es mínimo. Solo tablas de infraestructura:

| Propósito | Gems / tablas |
|---|---|
| Cache | Solid Cache |
| Jobs background | Solid Queue |
| WebSockets | Solid Cable / Action Cable |

No crear migraciones de negocio si la fuente de verdad es el API externo.

---

## Variables de entorno

Ver `.env.example` en la raíz del proyecto para la lista completa.

---

## Comandos de desarrollo

```bash
bundle install              # instalar gems
npm install                 # instalar dependencias JS
bin/dev                     # arrancar Rails + watcher de Tailwind
rails db:create db:migrate  # primera vez
playwright test             # E2E tests
npm run test:unit           # unit tests (Vitest)
```

---

## Archivos de documentación del proyecto

| Archivo | Contenido |
|---|---|
| `README.md` | Visión general y setup |
| `ESTRUCTURA.md` | Este archivo — arquitectura y convenciones |
| `docs/` | Documentación técnica detallada |
| `.env.example` | Variables de entorno necesarias |
