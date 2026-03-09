/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'Times New Roman', serif],
      },
      boxShadow: {
        'cc-sm': '0 1px 2px oklch(0.2 0.02 85 / 0.04)',
        'cc': '0 2px 8px oklch(0.2 0.02 85 / 0.06)',
        'cc-lg': '0 4px 16px oklch(0.2 0.02 85 / 0.08)',
      },
      colors: {
        cc: {
          primary: 'var(--cc-primary)',
          'primary-hover': 'var(--cc-primary-hover)',
          'primary-muted': 'var(--cc-primary-muted)',
          'primary-subtle': 'var(--cc-primary-subtle)',
          neutral: {
            50: 'var(--cc-neutral-50)',
            100: 'var(--cc-neutral-100)',
            200: 'var(--cc-neutral-200)',
            300: 'var(--cc-neutral-300)',
            400: 'var(--cc-neutral-400)',
            500: 'var(--cc-neutral-500)',
            600: 'var(--cc-neutral-600)',
            700: 'var(--cc-neutral-700)',
            800: 'var(--cc-neutral-800)',
            900: 'var(--cc-neutral-900)',
          },
          success: 'var(--cc-success)',
          'success-bg': 'var(--cc-success-bg)',
          error: 'var(--cc-error)',
          'error-bg': 'var(--cc-error-bg)',
          warning: 'var(--cc-warning)',
          'warning-bg': 'var(--cc-warning-bg)',
          surface: 'var(--cc-surface)',
          'surface-elevated': 'var(--cc-surface-elevated)',
          border: 'var(--cc-border)',
          'border-strong': 'var(--cc-border-strong)',
        },
      },
      borderRadius: {
        cc: 'var(--cc-radius)',
        'cc-lg': 'var(--cc-radius-lg)',
        'cc-xl': 'var(--cc-radius-xl)',
        'cc-2xl': 'var(--cc-radius-2xl)',
      },
    },
  },
  plugins: [],
}
