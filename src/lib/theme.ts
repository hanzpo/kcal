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
  page: '#FFFFFF',
  card: '#FFFFFF',
  raise: '#F1F0ED',
  ink: '#111110',
  inkSec: '#55534E',
  inkMut: '#8F8D88',
  inkFaint: '#BDBBB4',
  line: '#E7E5E0',
  protein: '#2A78D6',
  carbs: '#EB6834',
  fat: '#0FA371',
  energy: '#DE9300',
  good: '#0CA30C',
  isDark: false,
};

export const DARK: Palette = {
  page: '#0E0E0D',
  card: '#161615',
  raise: '#222220',
  ink: '#F2F1EE',
  inkSec: '#C9C7C0',
  inkMut: '#8F8D88',
  inkFaint: '#5C5A54',
  line: '#262624',
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

export const FONT_MONO = 'InstrumentSans_600SemiBold';
export const FONT_MONO_SEMI = 'InstrumentSans_700Bold';
