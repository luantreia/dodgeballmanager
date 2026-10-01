/**
 * Armado y descarga de CSV pensado para que el archivo se abra bien en Excel en español, que es
 * donde los DT lo van a abrir. Cada decisión de acá existe por un modo de fallar concreto:
 *
 * - **Separador `;` y no `,`.** Excel no usa un separador fijo: usa el "separador de listas" del
 *   sistema, que en es-AR y es-ES es `;`. Un CSV con comas se abre en una sola columna y hay que
 *   pasar por el asistente de importación. Google Sheets detecta los dos.
 * - **Decimales con coma.** Mismo motivo: con punto, Excel en español lee `0.47` como texto y
 *   cualquier promedio sobre esa columna da error.
 * - **BOM al principio.** Sin él, Excel en Windows abre el archivo como ANSI y todo acento o ñ
 *   sale roto — "Organización" queda "OrganizaciÃ³n".
 * - **Fin de línea CRLF.** Es lo que dice el RFC 4180 y lo que Excel espera.
 * - **Valores que empiezan con `=`, `+`, `-` o `@` se prefijan con un apóstrofo.** Los nombres de
 *   equipos, jugadores y competencias los escriben los usuarios, y Excel interpreta como fórmula
 *   cualquier celda que arranque con esos caracteres. Es la inyección de fórmulas de toda la vida:
 *   un equipo llamado `=HYPERLINK(...)` se volvería un link ejecutable en la máquina de quien abra
 *   el archivo. El apóstrofo lo fuerza a texto y no se ve en la celda.
 */

const SEPARADOR = ';';
const FIN_DE_LINEA = '\r\n';
/** U+FEFF. Lo que le dice a Excel que el archivo es UTF-8. */
const BOM = '﻿';

/** Caracteres con los que Excel empieza a evaluar una celda como fórmula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Una columna de la exportación: su encabezado y cómo sacar su valor de cada registro.
 *
 * Devolver `number` o `boolean` en vez de un string ya formateado es lo preferible: el formateo
 * (coma decimal, sí/no) lo hace esta capa una sola vez y de la misma forma en todas las
 * exportaciones.
 */
export type ColumnaCsv<T> = {
  encabezado: string;
  valor: (registro: T) => string | number | boolean | null | undefined;
  /** Decimales para un valor numérico no entero. Por defecto 2. */
  decimales?: number;
};

const formatearNumero = (valor: number, decimales: number): string => {
  if (!Number.isFinite(valor)) return '';
  const texto = Number.isInteger(valor) ? String(valor) : valor.toFixed(decimales);
  return texto.replace('.', ',');
};

/**
 * Entrecomilla si hace falta. No aplica el anti-fórmula: eso es sólo para texto que viene de los
 * usuarios (ver `escaparTexto`).
 *
 * Un número negativo tiene que seguir siendo un número. Prefijarlo con un apóstrofo lo convierte
 * en texto para Excel, y ahí cualquier suma o promedio sobre esa columna deja de funcionar — un
 * delta de −3 no es un intento de inyección, es un dato.
 */
const escaparGenerado = (texto: string): string => {
  const necesitaComillas =
    texto.includes(SEPARADOR) ||
    texto.includes('"') ||
    texto.includes('\n') ||
    texto.includes('\r') ||
    texto !== texto.trim();
  return necesitaComillas ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Escapa texto de origen desconocido: primero lo neutraliza como fórmula, después entrecomilla. */
const escaparTexto = (texto: string): string =>
  escaparGenerado(INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto);

const celda = <T,>(registro: T, columna: ColumnaCsv<T>): string => {
  const valor = columna.valor(registro);
  if (valor === null || valor === undefined) return '';
  // Los números y los booleanos los formatea esta capa, así que no son texto hostil posible.
  if (typeof valor === 'number') return escaparGenerado(formatearNumero(valor, columna.decimales ?? 2));
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  return escaparTexto(valor);
};

/** Construye el contenido CSV (con BOM) de una lista de registros. */
export const construirCsv = <T,>(registros: T[], columnas: Array<ColumnaCsv<T>>): string => {
  const lineas = [
    columnas.map((c) => escaparTexto(c.encabezado)).join(SEPARADOR),
    ...registros.map((registro) => columnas.map((c) => celda(registro, c)).join(SEPARADOR)),
  ];
  return BOM + lineas.join(FIN_DE_LINEA) + FIN_DE_LINEA;
};

/**
 * Nombre de archivo seguro a partir de texto libre: sin acentos, sin caracteres que Windows
 * rechace, y acotado para que no quede un nombre de 200 caracteres cuando hay muchos filtros.
 */
export const slugificar = (texto: string, largoMaximo = 60): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, largoMaximo)
    .replace(/-+$/g, '');

/** `YYYY-MM-DD` en hora local, para el nombre del archivo. */
const hoy = (): string => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

/**
 * `overtime-filas-foam-masculino-2026-10-01.csv`. La descripción es la de los filtros que estaban
 * aplicados, así que el archivo dice solo de qué recorte salió — sin eso, tres exportaciones del
 * mismo día quedan como "export (1)", "export (2)" y no hay forma de saber cuál era cuál.
 */
export const nombreArchivoCsv = (base: string, descripcion?: string): string => {
  const partes = ['overtime', slugificar(base, 30)];
  const detalle = descripcion ? slugificar(descripcion) : '';
  if (detalle) partes.push(detalle);
  partes.push(hoy());
  return `${partes.filter(Boolean).join('-')}.csv`;
};

/**
 * Dispara la descarga en el navegador. Separado del armado del contenido a propósito: lo de
 * arriba es puro y se puede testear, esto toca el DOM y no.
 */
export const descargarCsv = (nombreArchivo: string, contenido: string): void => {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  // Sin esto el blob queda retenido mientras viva la pestaña. El timeout es porque revocarlo en
  // el mismo tick del click cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
