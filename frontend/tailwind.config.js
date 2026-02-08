/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Fraunces', 'serif'],
        body: ['Manrope', 'sans-serif'],
        arabic: ['Noto Naskh Arabic', 'serif'],
      },
    },
  },
  plugins: [],
}
