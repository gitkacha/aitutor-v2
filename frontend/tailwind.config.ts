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
        // "Evening Navy" sidebar rail — solid colours derived from brand blue
        rail: {
          DEFAULT: '#102a4a',
          raise: '#1a3a61',
          text: '#d7e3f2',
          muted: '#8ca4c2',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;