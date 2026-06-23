// Helpers de formato de fechas reutilizables en toda la app.
//
// - relativeDate(value): tiempo relativo estilo "time-ago" en español.
// - formatDateTime(value): fecha absoluta "yyyy-MM-dd HH:mm:ss" (ver CLAUDE.md §5).
//
// Ambos aceptan strings de la API ("YYYY-MM-DD HH:MM:SS" o ISO con 'T') y
// devuelven '' (formatDateTime) o '—' (relativeDate) cuando el valor es
// null/undefined/vacío/"null" o no parsea a una fecha válida.

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Normaliza el valor crudo de la API: devuelve null si no representa una fecha.
function normalize(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === '' || str.toLowerCase() === 'null') return null;
  return str;
}

// Convierte el string a Date (admite "YYYY-MM-DD HH:MM:SS" y formato ISO).
function toDate(str) {
  const d = new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

// Tiempo relativo: Hace un momento / Hace N minutos / Hace N horas / Ayer /
// Hace N días, y a partir de 3 días la fecha en texto ("14 de mayo",
// agregando el año si difiere del actual). Si no parsea, devuelve el string tal cual.
export function relativeDate(value) {
  const str = normalize(value);
  if (str === null) return '—';

  const d = toDate(str);
  if (!d) return str;

  const now     = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);

  // Diferencia en días de calendario (para que "Ayer" sea correcto)
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (diffSec < 60)   return 'Hace un momento';
  if (diffMin < 60)   return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  if (diffHr  < 24)   return `Hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays <= 3)  return `Hace ${diffDays} días`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getDate()} de ${MESES[d.getMonth()]}`
    : `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Fecha absoluta en formato "yyyy-MM-dd HH:mm:ss" (ISO 8601 con espacio).
export function formatDateTime(value) {
  const str = normalize(value);
  if (str === null) return '';

  const d = toDate(str);
  if (!d) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
