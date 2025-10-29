export const formatDate = (isoDate: string, locale: string = 'es-AR'): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (isoDate: string, locale: string = 'es-AR'): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
