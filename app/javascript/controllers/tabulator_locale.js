// Locale español compartido para todas las tablas Tabulator de FEC.
//
// NO es un Stimulus controller (no se registra en index.js); es solo un módulo
// de configuración importado por los controllers que extienden TabulatorController.
//
// - Botones de navegación (primera/anterior/siguiente/última): íconos Material Icons.
//   Tabulator asigna estos labels como innerHTML, por eso se usan <span class="material-icons">.
// - Resto de textos (tamaño de página, contador, estados): en español.
//
// Uso en getTableConfig():
//   import { TABULATOR_LOCALE, TABULATOR_LANGS } from 'controllers/tabulator_locale'
//   { ...config, locale: TABULATOR_LOCALE, langs: TABULATOR_LANGS }

const navIcon = (name) =>
  `<span class="material-icons" style="font-size:18px;line-height:1;vertical-align:middle;">${name}</span>`;

// Spinner circular para el estado de carga de las tablas (dataLoaderLoading).
// Usa animación SVG nativa (SMIL) → no depende de CSS/keyframes ni de Tailwind.
export const TABULATOR_LOADING_HTML = `
  <div class="fec-table-spinner" role="status" aria-label="Cargando">
    <svg width="40" height="40" viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#e5e7eb" stroke-width="5"></circle>
      <circle cx="25" cy="25" r="20" fill="none" stroke="#2563eb" stroke-width="5"
              stroke-linecap="round" stroke-dasharray="80 200">
        <animateTransform attributeName="transform" attributeType="XML" type="rotate"
                          from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"></animateTransform>
      </circle>
    </svg>
  </div>`;

export const TABULATOR_LOCALE = 'es-es';

export const TABULATOR_LANGS = {
  'es-es': {
    pagination: {
      page_size:   'Filas por página',
      page_title:  'Mostrar página',
      first:       navIcon('first_page'),
      first_title: 'Primera página',
      prev:        navIcon('chevron_left'),
      prev_title:  'Página anterior',
      next:        navIcon('chevron_right'),
      next_title:  'Página siguiente',
      last:        navIcon('last_page'),
      last_title:  'Última página',
      all:         'Todos',
      counter: {
        showing: 'Mostrando',
        of:      'de',
        rows:    'filas',
        pages:   'páginas',
      },
    },
    data: {
      loading: 'Cargando',
      error:   'Error',
    },
  },
};
