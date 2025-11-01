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
