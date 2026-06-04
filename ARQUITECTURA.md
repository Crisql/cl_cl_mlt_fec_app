# Arquitectura y flujo de la aplicación

**Ruby · Rails 8 · Hotwire (Turbo + Stimulus) · Tailwind CSS**

---

## Árbol de archivos relevantes

```
cl_cl_mlt_fec_app/
│
├── config/
│   └── routes.rb                          ← Define todas las URLs de la app
│
├── app/
│   ├── controllers/
│   │   ├── application_controller.rb      ← Base de todos los controllers Rails
│   │   ├── sessions_controller.rb         ← Renderiza /login
│   │   ├── home_controller.rb             ← Renderiza /home
│   │   ├── proxy_controller.rb            ← Reenvía /api/* al API externo (Net::HTTP)
│   │   └── configurations/
│   │       └── permissions_controller.rb  ← Renderiza /configurations/permissions
│   │
│   ├── views/
│   │   ├── layouts/
│   │   │   └── application.html.erb       ← Layout base (carga Tailwind + JS bundle)
│   │   ├── sessions/
│   │   │   └── new.html.erb               ← Página de login
│   │   ├── home/
│   │   │   └── index.html.erb             ← Dashboard principal
│   │   └── configurations/
│   │       └── permissions/
│   │           └── index.html.erb
│   │
│   └── javascript/
│       ├── controllers/
│       │   ├── index.js                   ← Registra todos los Stimulus controllers
│       │   ├── application.js             ← Crea la instancia Stimulus
│       │   ├── auth_guard_controller.js   ← Verifica token en cada página protegida
│       │   ├── login_controller.js        ← Lógica del formulario de login
│       │   ├── menu_controller.js         ← Sidebar/menú de navegación
│       │   ├── company_selector_controller.js ← Selector de empresa (multi-tab)
│       │   ├── home_controller.js         ← Dashboard widgets
│       │   └── permissions_controller.js  ← Módulo de permisos
│       │
│       └── vendor/clavisco/
│           ├── core/index.js              ← Utilidades globales (Storage, SStore, apiRequest)
│           └── login/index.js             ← OAuth2 login + checkAuth
```

---

## Cómo se muestra una vista (flujo completo)

```
1. Browser pide GET /home
        │
        ▼
2. routes.rb   →   get '/home', to: 'home#index'
        │
        ▼
3. HomeController#index   →   renderiza app/views/home/index.html.erb
        │
        ▼
4. ERB incluye el layout application.html.erb
   que carga el JS bundle (Stimulus) y Tailwind
        │
        ▼
5. Browser recibe el HTML estático — sin datos todavía
        │
        ▼
6. Stimulus se inicializa y conecta los controllers
   que aparecen en el HTML como data-controller="..."

   Ejemplo en home/index.html.erb:
     <div data-controller="auth-guard home menu company-selector">
        │
        ▼
7. auth_guard_controller.js → connect()
   Lee localStorage['Session']
   ┌─ token ausente o expirado → window.location = '/login'
   └─ token válido → deja pasar, la página se muestra
        │
        ▼
8. home_controller.js → connect()
   Llama al API para cargar datos del dashboard
```

---

## Cómo el JS se comunica con el API externo

```
Stimulus controller
      │
      │  fetch('/api/Menu', { headers: { Authorization, cl-company-id } })
      │
      ▼
ProxyController#forward   (routes.rb: match '/api/*path', to: 'proxy#forward')
      │
      │  Net::HTTP → https://clfecrbyappapidev.clavisco.com/api/Menu
      │  (reenvía headers tal como llegaron, excepto Cookie/Origin/etc.)
      │
      ▼
API externo responde JSON
      │
      ▼
ProxyController devuelve la respuesta sin modificar
      │
      ▼
Stimulus controller recibe el JSON y actualiza el DOM
```

---

## Dónde vive el estado de sesión

| Dato | Storage | Por qué |
|---|---|---|
| `Session` (token JWT) | `localStorage` | Persiste entre pestañas y reinicios |
| `CurrentCompany` | `sessionStorage` | Una empresa distinta por pestaña (multi-tab) |
| `Permissions` | `sessionStorage` | Ligado a la empresa de la pestaña |
| `Menu`, `UserInfo`, etc. | `localStorage` | Compartidos entre pestañas |

El helper `Storage` (en `vendor/clavisco/core/index.js`) lee `localStorage`, y `SStore` lee `sessionStorage`. `getApiHeaders()` construye automáticamente los headers `Authorization` y `cl-company-id` para cada llamada al API.

---

## Regla para agregar un módulo nuevo

1. **Ruta** en `config/routes.rb`
2. **Controller Ruby** en `app/controllers/<namespace>/` → solo hace `render` (sin lógica de negocio)
3. **Vista ERB** en `app/views/<namespace>/<módulo>/index.html.erb` → HTML con `data-controller="auth-guard <mi-modulo>"`
4. **Stimulus controller** en `app/javascript/controllers/<mi_modulo>_controller.js` → llama a `/api/*` y actualiza el DOM
5. **Registrar** en `app/javascript/controllers/index.js`

Rails solo enruta y renderiza HTML. Todo lo que sea datos viene del API externo a través del proxy.
