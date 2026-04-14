import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:   'var(--color-canvas)',
        surface:  'var(--color-surface)',
        raised:   'var(--color-raised)',
        line:     'var(--color-line)',
        ink:      'var(--color-ink)',
        muted:    'var(--color-muted)',
        accent:   'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}

export default config
