import type { Food } from '@/db/schema';
import type { Meal } from '@/lib/dates';
import { microsJson, nutrientsFromFood, scaleNutrients, type Nutrients } from '@/lib/nutrition';
import { getAiFoodByName, insertFood, markFoodUsed, updateFood, type FoodInput } from '@/repos/foods';
import { insertEntry, type LogEntryInput } from '@/repos/logs';
import type { AiFoodItem } from '@/services/ai';

/** Log a catalog food at a gram amount, snapshotting nutrition at log time. */
export async function logFood(params: {
  food: Food;
  grams: number;
  /** Display quantity + unit, e.g. 1.5 x "1 cup (140 g)" or 150 x "g" */
  quantity: number;
  unit: string;
  meal: Meal;
  date: string;
  via: LogEntryInput['loggedVia'];
}) {
  const { food, grams, quantity, unit, meal, date, via } = params;
  const n = scaleNutrients(nutrientsFromFood(food), grams);
  const entry = await insertEntry({
    date,
    meal,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    quantity,
    unit,
    grams,
    kcal: n.kcal,
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
    micros: microsJson(n),
    loggedVia: via,
  });
  await markFoodUsed(food.id);
  return entry;
}

/** Quick add: direct kcal/macros with no backing food. */
export async function logQuickAdd(params: {
  name?: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  meal: Meal;
  date: string;
}) {
  return insertEntry({
    date: params.date,
    meal: params.meal,
    foodId: null,
    name: params.name?.trim() || 'Quick add',
    brand: null,
    quantity: 1,
    unit: 'entry',
    grams: null,
    kcal: params.kcal,
    proteinG: params.proteinG ?? 0,
    carbsG: params.carbsG ?? 0,
    fatG: params.fatG ?? 0,
    micros: null,
    loggedVia: 'quick',
  });
}

/**
 * Log AI-estimated items: each becomes a cached food (per-100g, source 'ai')
 * so repeats are instant, plus a snapshot log entry for the estimated portion.
 */
export async function logAiItems(params: {
  items: AiFoodItem[];
  meal: Meal;
  date: string;
  via: 'ai_photo' | 'ai_text';
}) {
  for (const item of params.items) {
    const f = 100 / item.grams;
    const per100: FoodInput = {
      name: item.name,
      brand: null,
      source: 'ai',
      sourceId: null,
      barcode: null,
      servingName: item.quantity_desc,
      servingGrams: item.grams,
      servings: JSON.stringify([{ name: item.quantity_desc, grams: item.grams }]),
      kcal: item.kcal * f,
      proteinG: item.protein_g * f,
      carbsG: item.carbs_g * f,
      fatG: item.fat_g * f,
      fiberG: item.fiber_g != null ? item.fiber_g * f : null,
      sugarG: item.sugar_g != null ? item.sugar_g * f : null,
      sodiumMg: item.sodium_mg != null ? item.sodium_mg * f : null,
    };
    const existing = await getAiFoodByName(item.name);
    let food;
    if (existing) {
      await updateFood(existing.id, per100);
      food = { ...existing, ...per100 };
    } else {
      food = await insertFood(per100);
    }
    const n: Nutrients = {
      kcal: item.kcal,
      proteinG: item.protein_g,
      carbsG: item.carbs_g,
      fatG: item.fat_g,
      fiberG: item.fiber_g,
      sugarG: item.sugar_g,
      sodiumMg: item.sodium_mg,
    };
    await insertEntry({
      date: params.date,
      meal: params.meal,
      foodId: food.id,
      name: item.name,
      brand: null,
      quantity: 1,
      unit: item.quantity_desc,
      grams: item.grams,
      kcal: item.kcal,
      proteinG: item.protein_g,
      carbsG: item.carbs_g,
      fatG: item.fat_g,
      micros: microsJson(n),
      loggedVia: params.via,
    });
    await markFoodUsed(food.id);
  }
}
