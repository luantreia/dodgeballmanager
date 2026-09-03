const SAFE_FALLBACK = 'Sin fecha';

const parseDate = (isoDate: string): Date | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (isoDate: string, locale: string = 'es-AR'): string => {
  const date = parseDate(isoDate);
  if (!date) return SAFE_FALLBACK;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (isoDate: string, locale: string = 'es-AR'): string => {
  const date = parseDate(isoDate);
  if (!date) return SAFE_FALLBACK;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const pad = (valor: number): string => String(valor).padStart(2, '0');

/**
 * Valor para un `<input type="datetime-local">`, que SIEMPRE habla en hora local del
 * dispositivo. Usar `toISOString().slice(0, 16)` acá —que es lo que había— mete UTC en un
 * campo que el navegador lee como local: en Argentina (UTC-3) el partido se abría 3 horas
 * más tarde, y como al guardar se volvía a convertir, cada edición corría el horario otras
 * 3 horas. Dos ediciones = 6 horas de diferencia.
 */
export const toDatetimeLocalValue = (isoDate?: string | null): string => {
  const date = parseDate(isoDate ?? '');
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

/** Inversa de `toDatetimeLocalValue`: hora local del input → ISO UTC para el backend. */
export const fromDatetimeLocalValue = (valor?: string | null): string | undefined => {
  if (!valor) return undefined;
  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Parte local `YYYY-MM-DD` de un ISO. Ojo: `iso.split('T')[0]` devuelve el día EN UTC. */
export const toLocalDatePart = (isoDate?: string | null): string => {
  const date = parseDate(isoDate ?? '');
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Parte local `HH:mm` de un ISO. */
export const toLocalTimePart = (isoDate?: string | null): string | undefined => {
  const date = parseDate(isoDate ?? '');
  if (!date) return undefined;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
