/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        card: {
          slate: '#1e293b',
        },
        accent: {
          teal: '#14b8a6',
        },
      },
    },
  },
  plugins: [],
}
