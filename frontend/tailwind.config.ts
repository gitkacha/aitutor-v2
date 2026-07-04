import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1c6dd0',
          green: '#2e9e5b',
          amber: '#f2a71b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;