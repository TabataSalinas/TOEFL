import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd0ff',
          300: '#8eb1ff',
          400: '#5986ff',
          500: '#3b63f6',
          600: '#2743eb',
          700: '#1f33d0',
          800: '#202ea8',
          900: '#202d85',
        },
      },
    },
  },
  plugins: [],
};

export default config;
