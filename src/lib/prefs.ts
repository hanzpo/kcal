import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { prefsStorage } from '@/lib/storage';

const storage = createJSONStorage<any>(() => prefsStorage);

/** Dashboard shows "remaining" (true) or "consumed" (false). */
export const remainingModeAtom = atomWithStorage<boolean>('pref.remainingMode', true, storage, {
  getOnInit: true,
});

/** Trends range in days. */
export const trendsRangeAtom = atomWithStorage<number>('pref.trendsRange', 30, storage, {
  getOnInit: true,
});

/** Currently viewed diary date (session-only). */
export const logDateAtom = atom<string | null>(null);

/** Apple Health weight sync enabled. */
export const healthSyncAtom = atomWithStorage<boolean>('pref.healthSync', false, storage, {
  getOnInit: true,
});

export function readHealthSyncPref(): boolean {
  try {
    return JSON.parse(prefsStorage.getItem('pref.healthSync') ?? 'false') === true;
  } catch {
    return false;
  }
}

export type ThemePref = 'system' | 'light' | 'dark';

/** Appearance override; 'system' follows iOS. */
export const themeAtom = atomWithStorage<ThemePref>('pref.theme', 'system', storage, {
  getOnInit: true,
});

/** Read synchronously at app start (before React) to apply the override early. */
export function readThemePref(): ThemePref {
  try {
    const raw = prefsStorage.getItem('pref.theme');
    const v = raw ? JSON.parse(raw) : null;
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}
