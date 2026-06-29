# TODOS — Deuda técnica pendiente de actualización del API

Este archivo registra los cambios de UI que **ya se aplicaron en las vistas** pero que
**NO se pueden completar todavía en el cliente del API** porque el backend aún no se ha
actualizado. Ver `CLAUDE.md` §24 para la convención completa.

**Regla:** al eliminar un campo visible de un formulario, se mantiene en la petición al API
enviando un **valor por defecto** desde el controller, y se anota aquí qué falta limpiar
cuando el endpoint deje de requerir ese campo.

Formato de cada entrada:

```markdown
## [Módulo / Formulario]

- [ ] Campo `NombreCampo` — eliminado de la vista en `ruta/vista.html.erb`.
      Aún se envía en el fetch de `controller_x.js` con valor por defecto `"..."`.
      **Pendiente API:** quitar `NombreCampo` del body/parámetros una vez el endpoint
      `/api/Endpoint` deje de requerirlo.
```

---

<!-- Las entradas de cambios pendientes van debajo de esta línea -->

## Bandejas de emisión — filtro de búsqueda (`/configurations/email-senders`)

- [ ] Campo `Host` — eliminado el filtro de la vista en
      `app/views/configurations/email_senders/index.html.erb` (select `filterHost`).
      Aún se envía en el payload del fetch de `email_senders_controller.js` (`#fetchPage`)
      con valor por defecto `''` (= todos), porque la búsqueda sigue siendo necesaria para
      la vista y `Host` es solo uno de sus parámetros.
      **Pendiente API:** quitar `Host` del body una vez el endpoint
      `POST /api/EmailConfig/SearchEmailConfig` deje de requerirlo.

> Nota: `GET /api/EmailConfig/GetHost` y `#loadHosts()` se eliminaron por completo en este
> mismo cambio — su único propósito era alimentar el dropdown de Host, así que no son deuda
> pendiente (ver criterio en CLAUDE.md §24).

## Bandejas de recepción — filtro de búsqueda (`/configurations/mail-parser`)

- [ ] Parámetro `mailServer` (filtro "Nombre del servidor") — eliminado el filtro de la vista
      en `app/views/configurations/mail_parser/index.html.erb` (input `filterServer`).
      Aún se envía en el query string del fetch de `mail_parser_controller.js` (`#fetchPage`)
      con valor por defecto `''`, porque la consulta `GET /api/mail-parser` alimenta la tabla
      y `mailServer` es solo uno de sus parámetros.
      **Pendiente API:** quitar `mailServer` del query string una vez el endpoint
      `GET /api/mail-parser` deje de requerirlo.
