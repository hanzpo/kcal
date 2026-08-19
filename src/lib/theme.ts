import { useColorScheme } from 'react-native';

/**
 * Raw color tokens for the places NativeWind can't reach (Skia charts, icon
 * tints, navigation chrome). Class-based styling should use tailwind tokens;
 * these mirror them exactly.
 */

export interface Palette {
  page: string;
  card: string;
  raise: string;
  ink: string;
  inkSec: string;
  inkMut: string;
  inkFaint: string;
  line: string;
  protein: string;
  carbs: string;
  fat: string;
  energy: string;
  good: string;
  isDark: boolean;
}

export const LIGHT: Palette = {
  page: '#F4F4F1',
  card: '#FCFCFB',
  raise: '#EDEDE8',
  ink: '#141412',
  inkSec: '#52514E',
  inkMut: '#8B8981',
  inkFaint: '#B8B6AD',
  line: '#E4E3DC',
  protein: '#2A78D6',
  carbs: '#EB6834',
  fat: '#0FA371',
  energy: '#DE9300',
  good: '#0CA30C',
  isDark: false,
};

export const DARK: Palette = {
  page: '#0D0D0D',
  card: '#1A1A19',
  raise: '#242422',
  ink: '#F6F6F3',
  inkSec: '#C3C2B7',
  inkMut: '#8B8981',
  inkFaint: '#5A5952',
  line: '#2C2C2A',
  protein: '#3987E5',
  carbs: '#E06A38',
  fat: '#1BB47E',
  energy: '#EDA100',
  good: '#2DB82D',
  isDark: true,
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const FONT_MONO = 'IBMPlexMono_500Medium';
export const FONT_MONO_SEMI = 'IBMPlexMono_600SemiBold';
