import { createMMKV } from 'react-native-mmkv';

/** Fast synchronous storage for UI preferences — never for diary data. */
export const prefs = createMMKV();

export const prefsStorage = {
  getItem: (key: string) => prefs.getString(key) ?? null,
  setItem: (key: string, value: string) => prefs.set(key, value),
  removeItem: (key: string) => prefs.remove(key),
};
