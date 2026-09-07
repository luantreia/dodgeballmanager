// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * jsdom no implementa ResizeObserver, y el `ResponsiveContainer` de recharts lo instancia al
 * montar: sin este stub, cualquier test que renderice un gráfico revienta con un
 * "ResizeObserver is not defined" que no tiene nada que ver con lo que se está probando.
 *
 * Devuelve medidas nulas a propósito. Los tests de gráficos verifican los datos y la tabla que
 * los acompaña, no el layout —en jsdom no hay layout que medir—, así que un observer que no
 * observa nada es exactamente lo que hace falta.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
