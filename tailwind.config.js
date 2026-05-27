/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1128',
          800: '#0f1b3d',
          700: '#1a2854',
          600: '#243266',
        },
        gold: {
          500: '#d4af37',
          400: '#e0bf52',
          600: '#b8962e',
        },
        player: {
          hammer: '#3b82f6',
          pep: '#ef4444',
          margot: '#22c55e',
          cedar: '#eab308',
        },
      },
      fontFamily: {
        heading: ['Oswald', 'Impact', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-up': 'count-up 1s ease-out',
        'highlight': 'highlight 1.2s ease-out',
        'live-blink': 'live-blink 1.4s infinite',
      },
      keyframes: {
        'count-up': {
          '0%': { transform: 'scale(1.2)', color: '#d4af37' },
          '100%': { transform: 'scale(1)', color: 'inherit' },
        },
        highlight: {
          '0%': { backgroundColor: 'rgba(212,175,55,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'live-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
