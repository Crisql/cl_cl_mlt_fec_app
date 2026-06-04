# cl_cl_mlt_fec_app

Factura electrónica CR — aplicación Rails 8 con Hotwire + Tailwind CSS.

## Levantar el servidor de desarrollo

Abre dos terminales y ejecuta cada comando en una:

```sh
# Terminal 1 — servidor Rails
rails server -p 3000

# Terminal 2 — compilación de Tailwind en modo watch
rails tailwindcss:watch
```

La app queda disponible en `http://localhost:3000`.

> **Nota (macOS/Linux):** también se puede usar `bin/dev` para levantar ambos procesos en una sola terminal con Foreman.
