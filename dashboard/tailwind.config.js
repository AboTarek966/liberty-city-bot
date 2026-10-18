/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        liberty: {
          primary: '#00d4ff',
          secondary: '#5865f2',
          dark: '#1a1a2e',
          darker: '#16213e',
          card: '#1f2a44',
          border: '#2d3a5c',
          success: '#00ff88',
          warning: '#ffd700',
          error: '#ff3366',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};