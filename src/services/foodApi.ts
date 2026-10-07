import type { FoodInput } from '@/repos/foods';

/**
 * External nutrition data: Open Food Facts (barcodes, branded search) and
 * USDA FoodData Central (generic foods). Everything is normalized to the
 * app's per-100g FoodInput shape before it leaves this module.
 */

const OFF_UA = 'Kcal/1.0 (personal macro tracker; hanznathanpo@gmail.com)';
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

let fdcApiKey = 'DEMO_KEY';
export function setFdcApiKey(key: string | null | undefined) {
  fdcApiKey = key?.trim() || 'DEMO_KEY';
}

const clean = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

/** OFF sometimes returns numeric fields as strings ("15"). */
const numeric = (v: unknown): number | null => {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : null;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Open Food Facts

interface OffNutriments {
  [key: string]: number | string | undefined;
}

const OFF_FIELDS =
  'code,product_name,brands,serving_size,serving_quantity,nutrition_data_per,nutriments';

function offMicrosFromNutriments(n: OffNutriments) {
  // OFF stores most micros in grams; convert to the app's mg/µg units.
  const g = (key: string) => clean(n[`${key}_100g`]);
  const gToMg = (v: number | null) => (v == null ? null : v * 1000);
  const gToUg = (v: number | null) => (v == null ? null : v * 1e6);
  return {
    fiberG: g('fiber'),
    sugarG: g('sugars'),
    satFatG: g('saturated-fat'),
    monoFatG: g('monounsaturated-fat'),
    polyFatG: g('polyunsaturated-fat'),
    transFatG: g('trans-fat'),
    cholesterolMg: gToMg(g('cholesterol')),
    sodiumMg: gToMg(g('sodium')) ?? (g('salt') != null ? g('salt')! * 400 : null),
    potassiumMg: gToMg(g('potassium')),
    calciumMg: gToMg(g('calcium')),
    ironMg: gToMg(g('iron')),
    magnesiumMg: gToMg(g('magnesium')),
    zincMg: gToMg(g('zinc')),
    vitaminAUg: gToUg(g('vitamin-a')),
    vitaminCMg: gToMg(g('vitamin-c')),
    vitaminDUg: gToUg(g('vitamin-d')),
    vitaminB12Ug: gToUg(g('vitamin-b12')),
    folateUg: gToUg(g('folates') ?? g('vitamin-b9')),
  };
}

function normalizeOffProduct(p: any): FoodInput | null {
  const n: OffNutriments = p?.nutriments ?? {};
  let kcal = clean(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = clean(n['energy-kj_100g']) ?? clean(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const proteinG = clean(n['proteins_100g']);
  const carbsG = clean(n['carbohydrates_100g']);
  const fatG = clean(n['fat_100g']);
  if (kcal == null || kcal > 900 || proteinG == null || carbsG == null || fatG == null) return null;

  const servingGrams = numeric(p.serving_quantity);
  const name = typeof p.product_name === 'string' && p.product_name.trim() ? p.product_name.trim() : null;
  if (!name) return null;
  const brandsRaw = Array.isArray(p.brands) ? p.brands.join(', ') : p.brands;
  const brand = typeof brandsRaw === 'string' && brandsRaw.trim() ? brandsRaw.split(',')[0].trim() : null;

  return {
    name,
    brand,
    source: 'off',
    sourceId: String(p.code ?? ''),
    barcode: p.code ? String(p.code) : null,
    servingName: typeof p.serving_size === 'string' ? p.serving_size : null,
    servingGrams,
    servings: servingGrams
      ? JSON.stringify([{ name: p.serving_size || `${servingGrams} g serving`, grams: servingGrams }])
      : null,
    kcal,
    proteinG,
    carbsG,
    fatG,
    ...offMicrosFromNutriments(n),
  };
}

/** iOS reports UPC-A as EAN-13 with a leading zero; OFF stores both forms. */
export function barcodeCandidates(raw: string): string[] {
  const code = raw.trim();
  const out = [code];
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  return out;
}

export async function lookupBarcodeOff(barcode: string): Promise<FoodInput | null> {
  for (const code of barcodeCandidates(barcode)) {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${OFF_FIELDS}`,
      { headers: { 'User-Agent': OFF_UA } },
    );
    if (!res.ok) continue;
    const json = await res.json();
    if (json.status !== 1 || !json.product) continue;
    const food = normalizeOffProduct(json.product);
    if (food) return food;
  }
  return null;
}

export async function searchOff(query: string, limit = 15): Promise<FoodInput[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=${limit}&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': OFF_UA } });
  if (!res.ok) return [];
  const json = await res.json();
  const hits: any[] = json.hits ?? [];
  return hits.map(normalizeOffProduct).filter((f): f is FoodInput => f != null);
}

// ---------------------------------------------------------------------------
// USDA FoodData Central

/** nutrientNumber → field mapping (values already per 100 g). */
const FDC_NUTRIENTS: Record<string, keyof FoodInput> = {
  '208': 'kcal',
  '203': 'proteinG',
  '205': 'carbsG',
  '204': 'fatG',
  '291': 'fiberG',
  '269': 'sugarG',
  '606': 'satFatG',
  '645': 'monoFatG',
  '646': 'polyFatG',
  '605': 'transFatG',
  '601': 'cholesterolMg',
  '307': 'sodiumMg',
  '306': 'potassiumMg',
  '301': 'calciumMg',
  '303': 'ironMg',
  '304': 'magnesiumMg',
  '309': 'zincMg',
  '320': 'vitaminAUg',
  '401': 'vitaminCMg',
  '328': 'vitaminDUg',
  '418': 'vitaminB12Ug',
  '417': 'folateUg',
};

function normalizeFdcSearchFood(f: any): FoodInput | null {
  const values: Partial<Record<keyof FoodInput, number>> = {};
  for (const fn of f.foodNutrients ?? []) {
    const key = FDC_NUTRIENTS[String(fn.nutrientNumber)];
    const v = clean(fn.value);
    if (key && v != null && values[key] == null) values[key] = v;
  }
  // Foundation foods sometimes report only kJ (nutrient 268)
  if (values.kcal == null) {
    const kj = (f.foodNutrients ?? []).find((x: any) => String(x.nutrientNumber) === '268');
    const v = clean(kj?.value);
    if (v != null) values.kcal = v / 4.184;
  }
  if (values.kcal == null) return null;

  const name = titleCaseFdc(String(f.description ?? '').trim());
  if (!name) return null;
  const servingGrams = clean(f.servingSize) && f.servingSizeUnit?.toUpperCase?.() === 'GRM' ? f.servingSize : null;
  const servingName = typeof f.householdServingFullText === 'string' ? f.householdServingFullText.trim() : null;

  return {
    name,
    brand: typeof f.brandOwner === 'string' && f.brandOwner.trim() ? f.brandOwner.trim() : null,
    source: 'usda',
    sourceId: String(f.fdcId),
    barcode: typeof f.gtinUpc === 'string' && f.gtinUpc ? f.gtinUpc : null,
    servingName,
    servingGrams,
    servings: servingGrams ? JSON.stringify([{ name: servingName || 'serving', grams: servingGrams }]) : null,
    kcal: values.kcal,
    proteinG: values.proteinG ?? 0,
    carbsG: values.carbsG ?? 0,
    fatG: values.fatG ?? 0,
    fiberG: values.fiberG ?? null,
    sugarG: values.sugarG ?? null,
    satFatG: values.satFatG ?? null,
    monoFatG: values.monoFatG ?? null,
    polyFatG: values.polyFatG ?? null,
    transFatG: values.transFatG ?? null,
    cholesterolMg: values.cholesterolMg ?? null,
    sodiumMg: values.sodiumMg ?? null,
    potassiumMg: values.potassiumMg ?? null,
    calciumMg: values.calciumMg ?? null,
    ironMg: values.ironMg ?? null,
    magnesiumMg: values.magnesiumMg ?? null,
    zincMg: values.zincMg ?? null,
    vitaminAUg: values.vitaminAUg ?? null,
    vitaminCMg: values.vitaminCMg ?? null,
    vitaminDUg: values.vitaminDUg ?? null,
    vitaminB12Ug: values.vitaminB12Ug ?? null,
    folateUg: values.folateUg ?? null,
  };
}

/** "Broccoli, raw" → "Broccoli, raw" but ALL-CAPS branded names → Title Case. */
function titleCaseFdc(s: string): string {
  if (s !== s.toUpperCase() || s.length < 4) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s,(/-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export async function searchFdc(
  query: string,
  dataTypes = 'SR Legacy,Foundation',
  limit = 15,
): Promise<FoodInput[]> {
  const url = `${FDC_BASE}/foods/search?api_key=${fdcApiKey}&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent(dataTypes)}&pageSize=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.foods ?? [])
    .map(normalizeFdcSearchFood)
    .filter((f: FoodInput | null): f is FoodInput => f != null);
}

/** Barcode fallback: FDC Branded foods are queryable by UPC. */
export async function lookupBarcodeFdc(barcode: string): Promise<FoodInput | null> {
  for (const code of barcodeCandidates(barcode)) {
    const results = await searchFdc(code, 'Branded', 3).catch(() => []);
    const exact = results.find((f) => f.barcode && barcodeCandidates(f.barcode).includes(code));
    if (exact ?? results[0]) return exact ?? results[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Combined lookups

export async function lookupBarcode(barcode: string): Promise<FoodInput | null> {
  const off = await lookupBarcodeOff(barcode).catch(() => null);
  if (off) return off;
  return lookupBarcodeFdc(barcode).catch(() => null);
}

export interface RemoteSearchResults {
  generic: FoodInput[];
  branded: FoodInput[];
}

export async function searchRemote(query: string): Promise<RemoteSearchResults> {
  const [generic, branded] = await Promise.all([
    searchFdc(query).catch(() => [] as FoodInput[]),
    searchOff(query).catch(() => [] as FoodInput[]),
  ]);
  return { generic, branded };
}
