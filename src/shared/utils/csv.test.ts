import { construirCsv, descargarCsv, nombreArchivoCsv, slugificar, type ColumnaCsv } from './csv';

const BOM = '﻿';

type Registro = { nombre: string; cantidad: number; ratio: number | null; activo: boolean };

const columnas: Array<ColumnaCsv<Registro>> = [
  { encabezado: 'Nombre', valor: (r) => r.nombre },
  { encabezado: 'Cantidad', valor: (r) => r.cantidad },
  { encabezado: 'Ratio', valor: (r) => r.ratio, decimales: 3 },
  { encabezado: 'Activo', valor: (r) => r.activo },
];

/** Sin el BOM y partido en líneas, que es lo que importa comparar en los tests. */
const lineas = (csv: string): string[] => {
  expect(csv.startsWith(BOM)).toBe(true);
  return csv.slice(BOM.length).trimEnd().split('\r\n');
};

describe('construirCsv', () => {
  it('escribe el encabezado y una línea por registro, separadas por punto y coma', () => {
    const csv = construirCsv(
      [{ nombre: 'Nahum', cantidad: 4, ratio: 0.5, activo: true }],
      columnas,
    );

    expect(lineas(csv)).toEqual(['Nombre;Cantidad;Ratio;Activo', 'Nahum;4;0,500;sí']);
  });

  it('termina el archivo con fin de línea CRLF', () => {
    const csv = construirCsv([{ nombre: 'a', cantidad: 1, ratio: null, activo: false }], columnas);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('usa coma decimal y deja los enteros sin decimales', () => {
    // Excel en español lee "0.47" como texto: cualquier promedio sobre esa columna daría error.
    const csv = construirCsv(
      [
        { nombre: 'con decimales', cantidad: 10, ratio: 0.4736, activo: true },
        { nombre: 'entero', cantidad: 10, ratio: 2, activo: true },
      ],
      columnas,
    );

    const [, conDecimales, entero] = lineas(csv);
    expect(conDecimales).toContain(';0,474;');
    expect(entero).toContain(';2;');
  });

  it('deja vacías las celdas null y undefined', () => {
    const csv = construirCsv([{ nombre: '', cantidad: 0, ratio: null, activo: false }], columnas);
    expect(lineas(csv)[1]).toBe(';0;;no');
  });

  it('entrecomilla y duplica las comillas internas', () => {
    const csv = construirCsv(
      [{ nombre: 'Los "Perros"', cantidad: 1, ratio: null, activo: true }],
      columnas,
    );
    expect(lineas(csv)[1]).toContain('"Los ""Perros"""');
  });

  it('entrecomilla un valor que contiene el separador', () => {
    const csv = construirCsv(
      [{ nombre: 'Marvin; Buenos Aires', cantidad: 1, ratio: null, activo: true }],
      columnas,
    );
    expect(lineas(csv)[1]).toContain('"Marvin; Buenos Aires"');
  });

  it('entrecomilla un valor con salto de línea, sin romper la fila', () => {
    const csv = construirCsv(
      [{ nombre: 'dos\nlíneas', cantidad: 1, ratio: null, activo: true }],
      columnas,
    );
    // El salto queda adentro de las comillas: el archivo sigue teniendo 2 filas lógicas.
    expect(csv).toContain('"dos\nlíneas"');
  });

  it('entrecomilla un valor con espacios al borde, para que no se pierdan', () => {
    const csv = construirCsv(
      [{ nombre: '  Marvin  ', cantidad: 1, ratio: null, activo: true }],
      columnas,
    );
    expect(lineas(csv)[1]).toContain('"  Marvin  "');
  });

  describe('inyección de fórmulas', () => {
    // Los nombres de equipos, jugadores y competencias los escriben los usuarios. Excel evalúa
    // como fórmula cualquier celda que arranque con =, +, - o @, así que un nombre hostil se
    // volvería código ejecutable en la máquina de quien abre el archivo.
    it.each(['=HYPERLINK("http://x","click")', '+1+1', '-1+1', '@SUM(A1)', '\tcmd'])(
      'neutraliza un valor de texto que empieza como fórmula: %s',
      (hostil) => {
        const csv = construirCsv(
          [{ nombre: hostil, cantidad: 1, ratio: null, activo: true }],
          columnas,
        );
        // Entrecomillado o no según el contenido, pero el primer carácter del valor es el
        // apóstrofo: Excel ya no lo evalúa.
        const fila = lineas(csv)[1];
        expect(fila.startsWith("'") || fila.startsWith('"\'')).toBe(true);
      },
    );

    it('también protege un encabezado, que puede ser un nombre de segmento del usuario', () => {
      const csv = construirCsv([{ cantidad: 1 }], [
        { encabezado: '=malicioso', valor: (r: { cantidad: number }) => r.cantidad },
      ]);
      expect(lineas(csv)[0]).toBe("'=malicioso");
    });

    it('no toca un nombre normal', () => {
      const csv = construirCsv(
        [{ nombre: 'Marvin', cantidad: 1, ratio: null, activo: true }],
        columnas,
      );
      expect(lineas(csv)[1]).toBe('Marvin;1;;sí');
    });

    it('un número negativo sigue siendo número: prefijarlo rompería las sumas en Excel', () => {
      const soloCantidad: Array<ColumnaCsv<{ cantidad: number }>> = [
        { encabezado: 'Cantidad', valor: (r) => r.cantidad },
      ];
      const csv = construirCsv([{ cantidad: -3 }], soloCantidad);
      expect(lineas(csv)[1]).toBe('-3');
    });
  });

  it('sin registros deja sólo el encabezado', () => {
    expect(lineas(construirCsv([], columnas))).toEqual(['Nombre;Cantidad;Ratio;Activo']);
  });
});

describe('descargarCsv', () => {
  // jsdom no implementa la API de blobs: se mockea para poder verificar que el archivo sale con
  // el nombre pedido y que el objeto temporal se libera.
  const crear = jest.fn();
  const revocar = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    // La implementación va acá y no en el `jest.fn(...)`: CRA corre con `resetMocks`, que antes
    // de cada test borra las implementaciones y dejaría al mock devolviendo `undefined`.
    crear.mockReturnValue('blob:fake');
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispara la descarga con el nombre pedido y después libera el blob', () => {
    const clicks: string[] = [];
    const clickOriginal = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function registrar(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };

    try {
      descargarCsv('overtime-filas-2026-10-01.csv', 'a;b\r\n');
    } finally {
      HTMLAnchorElement.prototype.click = clickOriginal;
    }

    expect(clicks).toEqual(['overtime-filas-2026-10-01.csv']);
    expect(crear).toHaveBeenCalledTimes(1);

    // No se libera en el mismo tick: revocarlo ahí cancela la descarga en algunos navegadores.
    expect(revocar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(revocar).toHaveBeenCalledWith('blob:fake');
  });

  it('no deja el enlace temporal colgado en el documento', () => {
    const clickOriginal = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function noop() {};
    try {
      descargarCsv('x.csv', 'a\r\n');
    } finally {
      HTMLAnchorElement.prototype.click = clickOriginal;
    }
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('slugificar', () => {
  it('saca acentos, mayúsculas y caracteres raros', () => {
    expect(slugificar('Foam · Masculino / Organización')).toBe('foam-masculino-organizacion');
  });

  it('acota el largo y no deja un guion colgando', () => {
    expect(slugificar('a'.repeat(80), 10)).toBe('aaaaaaaaaa');
    expect(slugificar('abcdefghij-klmno', 11)).toBe('abcdefghij');
  });

  it('con texto sin nada útil devuelve vacío', () => {
    expect(slugificar('··· ///')).toBe('');
  });
});

describe('nombreArchivoCsv', () => {
  it('arma el nombre con la base, el recorte y la fecha', () => {
    const nombre = nombreArchivoCsv('filas', 'Foam · Masculino');
    expect(nombre).toMatch(/^overtime-filas-foam-masculino-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('sin descripción del recorte no deja un doble guion', () => {
    expect(nombreArchivoCsv('filas')).toMatch(/^overtime-filas-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('una descripción que se slugifica a vacío no agrega nada', () => {
    expect(nombreArchivoCsv('filas', '···')).toMatch(/^overtime-filas-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
