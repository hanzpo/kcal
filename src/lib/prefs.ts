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
