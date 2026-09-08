const formsPlugin = require('@tailwindcss/forms');
const typographyPlugin = require('@tailwindcss/typography');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebefff',
          200: '#d6deff',
          300: '#b0bfff',
          400: '#7a90ff',
          500: '#3b5dff',
          600: '#2b45db',
          700: '#2135ab',
          800: '#1f3188',
          900: '#1f2c6d',
        },
      },
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
      /**
       * Para decidir "modal pantalla completa vs. diálogo centrado" en vez de `sm:`. Un
       * celular en horizontal casi siempre supera los 640px de ANCHO pero tiene poca ALTURA
       * (~350-450px) — con `sm:` solo, se trataba como desktop y aparecía con márgenes
       * alrededor, justo cuando menos alto sobra. Exige ancho Y alto de sobra a la vez.
       */
      boxed: { raw: '(min-width: 640px) and (min-height: 500px)' },
    },
  },
  plugins: [formsPlugin, typographyPlugin],
};
