# cl_cl_mlt_fec_app

Factura electrónica CR — aplicación Rails 8 con Hotwire + Tailwind CSS.

## Levantar el servidor de desarrollo

### Opción 1 — Un solo comando (recomendado)

Levanta el servidor Rails y el watcher de Tailwind en paralelo usando Foreman:

```sh
bin/dev
```

Requiere tener `foreman` instalado (`gem install foreman`). El script lo instala automáticamente si no está.

### Opción 2 — Procesos por separado

Abre dos terminales y ejecuta cada comando en una:

```sh
# Terminal 1 — servidor Rails
bin/rails server -p 3000

# Terminal 2 — compilación de Tailwind en modo watch
bin/rails tailwindcss:watch
```

La app queda disponible en `http://localhost:3000`.
