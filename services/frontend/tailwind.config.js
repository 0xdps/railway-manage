/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        railway: {
          50: '#f8f9ff',
          100: '#eef1ff',
          200: '#dee5ff',
          300: '#c5d3ff',
          400: '#a8b9ff',
          500: '#8b9dff',
          600: '#6b7dff',
          700: '#505fff',
          800: '#3f47e6',
          900: '#2e2fa8',
        },
      },
    },
  },
  plugins: [],
};
