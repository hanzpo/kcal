/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // warm paper / carbon neutrals
        page: { DEFAULT: '#F4F4F1', dark: '#0D0D0D' },
        card: { DEFAULT: '#FCFCFB', dark: '#1A1A19' },
        raise: { DEFAULT: '#EDEDE8', dark: '#242422' }, // pressed / inset surfaces
        ink: {
          DEFAULT: '#141412',
          sec: '#52514E',
          mut: '#8B8981',
          faint: '#B8B6AD',
          inv: '#F6F6F3',
          dsec: '#C3C2B7',
          dmut: '#8B8981',
        },
        line: { DEFAULT: '#E4E3DC', dark: '#2C2C2A' },
        // fixed macro identities (chart-safe, first three categorical slots)
        protein: { DEFAULT: '#2A78D6', dark: '#3987E5' },
        carbs: { DEFAULT: '#EB6834', dark: '#E06A38' },
        fat: { DEFAULT: '#0FA371', dark: '#1BB47E' },
        // energy accent (kcal ring, highlights)
        energy: { DEFAULT: '#DE9300', dark: '#EDA100' },
        good: { DEFAULT: '#0CA30C', dark: '#2DB82D' },
      },
      fontFamily: {
        mono: ['IBMPlexMono_500Medium'],
        monosemi: ['IBMPlexMono_600SemiBold'],
      },
      borderRadius: {
        card: '20px',
        chip: '12px',
      },
    },
  },
  plugins: [],
};
