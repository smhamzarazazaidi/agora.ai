/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/client/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: '#f5f6f7',
        bg2: '#eef0f2',
        surface: '#ffffff',
        text: { DEFAULT: '#2f2f33', 2: '#6b7280', 3: '#9ca3af' },
        border: { DEFAULT: '#e5e7eb', 2: '#d1d5db' },
        agent: {
          blue: { bg: '#eef4ff', border: '#c7d9ff', text: '#3b5bdb' },
          green: { bg: '#edfdf4', border: '#bbf7d0', text: '#16a34a' },
          amber: { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
        },
      },
      borderRadius: {
        card: '12px',
        sm: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04)',
        lg: '0 4px 24px rgba(0,0,0,.08),0 1px 4px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
}
