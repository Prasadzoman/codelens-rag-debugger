/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        codelens: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          primary: '#38bdf8',
          accent: '#818cf8',
          error: '#f43f5e',
          success: '#10b981',
          warning: '#f59e0b'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
