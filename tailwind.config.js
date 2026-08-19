/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // ledger: pure white page, near-black dark, hairline rules
        page: { DEFAULT: '#FFFFFF', dark: '#0E0E0D' },
        card: { DEFAULT: '#FFFFFF', dark: '#161615' },
        raise: { DEFAULT: '#F1F0ED', dark: '#222220' }, // pressed / inset surfaces
        ink: {
          DEFAULT: '#111110',
          sec: '#55534E',
          mut: '#8F8D88',
          faint: '#BDBBB4',
          inv: '#F2F1EE',
          dsec: '#C9C7C0',
          dmut: '#8F8D88',
        },
        line: { DEFAULT: '#E7E5E0', dark: '#262624' },
        // fixed macro identities (chart-safe, first three categorical slots)
        protein: { DEFAULT: '#2A78D6', dark: '#3987E5' },
        carbs: { DEFAULT: '#EB6834', dark: '#E06A38' },
        fat: { DEFAULT: '#0FA371', dark: '#1BB47E' },
        // energy accent (kcal ring, highlights)
        energy: { DEFAULT: '#DE9300', dark: '#EDA100' },
        good: { DEFAULT: '#0CA30C', dark: '#2DB82D' },
      },
      fontFamily: {
        // numeral faces (legacy class names kept so every number reskins at once)
        mono: ['InstrumentSans_600SemiBold'],
        monosemi: ['InstrumentSans_700Bold'],
      },
      borderRadius: {
        card: '14px',
        chip: '10px',
      },
    },
  },
  plugins: [],
};
