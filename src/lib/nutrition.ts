import type { Food } from '@/db/schema';

/** Full nutrient snapshot; macros always present, micros optional. Per-100g or absolute depending on context. */
export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  satFatG?: number | null;
  monoFatG?: number | null;
  polyFatG?: number | null;
  transFatG?: number | null;
  cholesterolMg?: number | null;
  sodiumMg?: number | null;
  potassiumMg?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  magnesiumMg?: number | null;
  zincMg?: number | null;
  vitaminAUg?: number | null;
  vitaminCMg?: number | null;
  vitaminDUg?: number | null;
  vitaminB12Ug?: number | null;
  folateUg?: number | null;
}

export const MICRO_KEYS = [
  'fiberG',
  'sugarG',
  'satFatG',
  'monoFatG',
  'polyFatG',
  'transFatG',
  'cholesterolMg',
  'sodiumMg',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'zincMg',
  'vitaminAUg',
  'vitaminCMg',
  'vitaminDUg',
  'vitaminB12Ug',
  'folateUg',
] as const;

export type MicroKey = (typeof MICRO_KEYS)[number];

export interface MicroMeta {
  label: string;
  unit: 'g' | 'mg' | 'µg';
  /** Adult daily reference value (FDA DV where applicable). */
  dv: number;
  /** Nutrients where lower is generally better (display without "goal" framing). */
  limit?: boolean;
}

export const MICRO_META: Record<MicroKey, MicroMeta> = {
  fiberG: { label: 'Fiber', unit: 'g', dv: 28 },
  sugarG: { label: 'Sugar', unit: 'g', dv: 50, limit: true },
  satFatG: { label: 'Saturated fat', unit: 'g', dv: 20, limit: true },
  monoFatG: { label: 'Monounsaturated fat', unit: 'g', dv: 22 },
  polyFatG: { label: 'Polyunsaturated fat', unit: 'g', dv: 20 },
  transFatG: { label: 'Trans fat', unit: 'g', dv: 2, limit: true },
  cholesterolMg: { label: 'Cholesterol', unit: 'mg', dv: 300, limit: true },
  sodiumMg: { label: 'Sodium', unit: 'mg', dv: 2300, limit: true },
  potassiumMg: { label: 'Potassium', unit: 'mg', dv: 4700 },
  calciumMg: { label: 'Calcium', unit: 'mg', dv: 1300 },
  ironMg: { label: 'Iron', unit: 'mg', dv: 18 },
  magnesiumMg: { label: 'Magnesium', unit: 'mg', dv: 420 },
  zincMg: { label: 'Zinc', unit: 'mg', dv: 11 },
  vitaminAUg: { label: 'Vitamin A', unit: 'µg', dv: 900 },
  vitaminCMg: { label: 'Vitamin C', unit: 'mg', dv: 90 },
  vitaminDUg: { label: 'Vitamin D', unit: 'µg', dv: 20 },
  vitaminB12Ug: { label: 'Vitamin B12', unit: 'µg', dv: 2.4 },
  folateUg: { label: 'Folate', unit: 'µg', dv: 400 },
};

/** A named portion of a food, e.g. { name: "1 bar", grams: 45 }. */
export interface ServingOption {
  name: string;
  grams: number;
}

export function parseServings(food: Pick<Food, 'servings' | 'servingName' | 'servingGrams'>): ServingOption[] {
  const out: ServingOption[] = [];
  if (food.servings) {
    try {
      const parsed = JSON.parse(food.servings) as ServingOption[];
      for (const s of parsed) {
        if (s && typeof s.grams === 'number' && s.grams > 0 && s.name) out.push(s);
      }
    } catch {
      // ignore malformed serving JSON; grams fallback always exists
    }
  }
  if (out.length === 0 && food.servingGrams && food.servingGrams > 0) {
    out.push({ name: food.servingName ?? 'serving', grams: food.servingGrams });
  }
  return out;
}

/** Scale a food's per-100g nutrients to an absolute gram amount. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const scale = (v: number | null | undefined) => (v == null ? null : v * f);
  return {
    kcal: per100g.kcal * f,
    proteinG: per100g.proteinG * f,
    carbsG: per100g.carbsG * f,
    fatG: per100g.fatG * f,
    ...Object.fromEntries(MICRO_KEYS.map((k) => [k, scale(per100g[k])])),
  };
}

export function nutrientsFromFood(food: Food): Nutrients {
  return {
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    ...Object.fromEntries(MICRO_KEYS.map((k) => [k, food[k]])),
  };
}

export function addNutrients(a: Nutrients, b: Partial<Nutrients>): Nutrients {
  const addOpt = (x?: number | null, y?: number | null) =>
    x == null && y == null ? null : (x ?? 0) + (y ?? 0);
  return {
    kcal: a.kcal + (b.kcal ?? 0),
    proteinG: a.proteinG + (b.proteinG ?? 0),
    carbsG: a.carbsG + (b.carbsG ?? 0),
    fatG: a.fatG + (b.fatG ?? 0),
    ...Object.fromEntries(MICRO_KEYS.map((k) => [k, addOpt(a[k], b[k])])),
  };
}

export const ZERO_NUTRIENTS: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Micros-only JSON snapshot for log entries. */
export function microsJson(n: Nutrients): string {
  const micros: Record<string, number> = {};
  for (const k of MICRO_KEYS) {
    const v = n[k];
    if (v != null) micros[k] = v;
  }
  return JSON.stringify(micros);
}

export function parseMicros(json: string | null): Partial<Nutrients> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Partial<Nutrients>;
  } catch {
    return {};
  }
}
