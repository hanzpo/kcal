import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';

import { addDaysStr, toDateStr, todayStr } from '@/lib/dates';
import { getAllWeights, upsertWeight } from '@/repos/weights';

/**
 * Apple Health bridge — the integration path for smart scales (Renpho, Withings,
 * Eufy…): their apps write body mass to Health; Kcal imports it. Kcal also
 * writes its own manual weigh-ins back so Health stays the single record.
 */

const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;

export function healthAvailable(): boolean {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function requestWeightAccess(): Promise<boolean> {
  if (!healthAvailable()) return false;
  try {
    return await requestAuthorization({ toRead: [BODY_MASS], toShare: [BODY_MASS] });
  } catch {
    return false;
  }
}

/**
 * Pull body-mass samples from Health and merge into the weights table.
 * Latest sample per calendar day wins; days already matching are skipped.
 * Returns how many days were added or updated.
 */
export async function importWeightsFromHealth(days = 365): Promise<number> {
  if (!healthAvailable()) return 0;
  const startDate = new Date(`${addDaysStr(todayStr(), -days)}T00:00:00`);

  const samples = await queryQuantitySamples(BODY_MASS, {
    filter: { date: { startDate } },
    unit: 'kg',
    limit: 2000,
    ascending: true,
  });

  // last sample per local calendar day
  const byDay = new Map<string, number>();
  for (const s of samples) {
    const date = toDateStr(new Date(s.startDate));
    byDay.set(date, s.quantity);
  }

  const existing = new Map((await getAllWeights()).map((w) => [w.date, w.weightKg]));
  let changed = 0;
  for (const [date, kg] of byDay) {
    if (!(kg > 20 && kg < 400)) continue;
    const cur = existing.get(date);
    if (cur != null && Math.abs(cur - kg) < 0.01) continue;
    await upsertWeight(date, kg);
    changed++;
  }
  return changed;
}

/** Write a Kcal weigh-in to Health (no-op if unavailable/unauthorized). */
export async function exportWeightToHealth(date: string, weightKg: number): Promise<void> {
  if (!healthAvailable()) return;
  try {
    const at = new Date(`${date}T08:00:00`);
    await saveQuantitySample(BODY_MASS, 'kg', weightKg, at, at);
  } catch {
    // authorization declined or write failed — Health export is best-effort
  }
}
