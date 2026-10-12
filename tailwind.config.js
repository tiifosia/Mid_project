/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#111111',
        surface: '#333333',
        'text-secondary': '#8d8d8d',
        'text-primary': '#F5F5F5',
        accent: '#C3BDFF',
      },
    },
  },
  plugins: [],
}
