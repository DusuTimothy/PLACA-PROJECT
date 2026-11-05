/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        placa: {
          50: '#eef8f2',
          100: '#d6ecdf',
          200: '#aedbc3',
          300: '#7cc3a1',
          400: '#48a67c',
          500: '#278a60',
          600: '#0f6b3f',
          700: '#0c5734',
          800: '#0a452a',
          900: '#073620',
        },
        ink: '#17211b',
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      minHeight: {
        tap: '44px',
      },
    },
  },
  plugins: [],
};
