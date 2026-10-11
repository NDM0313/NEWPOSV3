/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f5f3ff', 500: '#8B5CF6', 600: '#7C3AED' },
      },
    },
  },
  plugins: [],
};
