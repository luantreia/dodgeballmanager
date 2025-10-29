export const formatNumber = (value: number, locales: string | string[] = 'es-AR') =>
  new Intl.NumberFormat(locales, {
    maximumFractionDigits: 1,
  }).format(value);
