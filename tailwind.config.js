const formsPlugin = require('@tailwindcss/forms');
const typographyPlugin = require('@tailwindcss/typography');
const overtimeKit = require('overtime-kit/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // `boxed` nació acá (ver el historial de este archivo) y ahora lo aporta el preset del kit,
  // que es exactamente el mismo breakpoint. Se saca la definición local para no tener dos
  // fuentes del mismo valor; `overtime-kit/tailwind-preset` es la que queda canónica.
  presets: [overtimeKit],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
    // El `content` del preset no se hereda: Tailwind reemplaza esta clave, no la fusiona.
    ...overtimeKit.content,
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 25px -15px rgba(15, 23, 42, 0.35)',
      },
    },
    screens: {
      xs: '440px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [formsPlugin, typographyPlugin],
};
