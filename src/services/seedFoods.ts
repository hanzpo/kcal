import type { FoodInput } from '@/repos/foods';

/**
 * Bundled starter catalog of ~85 common foods (USDA SR Legacy-style values,
 * per 100 g) so generic search works instantly and offline. Loaded into the
 * foods table on first run; sourceId 'seed:<slug>' keeps the load idempotent.
 */

interface SeedExtra {
  fiberG?: number;
  sugarG?: number;
  satFatG?: number;
  sodiumMg?: number;
  potassiumMg?: number;
  serving?: [string, number];
  servings?: [string, number][];
  brand?: string;
}

function f(
  slug: string,
  name: string,
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  extra: SeedExtra = {},
): FoodInput {
  const servings = extra.servings ?? (extra.serving ? [extra.serving] : []);
  const primary = servings[0];
  return {
    name,
    brand: extra.brand ?? null,
    source: 'usda',
    sourceId: `seed:${slug}`,
    barcode: null,
    servingName: primary?.[0] ?? null,
    servingGrams: primary?.[1] ?? null,
    servings: servings.length
      ? JSON.stringify(servings.map(([sName, grams]) => ({ name: sName, grams })))
      : null,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: extra.fiberG ?? null,
    sugarG: extra.sugarG ?? null,
    satFatG: extra.satFatG ?? null,
    sodiumMg: extra.sodiumMg ?? null,
    potassiumMg: extra.potassiumMg ?? null,
  };
}

export const SEED_FOODS: FoodInput[] = [
  // Proteins
  f('chicken-breast', 'Chicken breast, cooked', 165, 31, 0, 3.6, { satFatG: 1, sodiumMg: 74, potassiumMg: 256, serving: ['1 breast (170 g)', 170], servings: [['1 breast (170 g)', 170], ['3 oz (85 g)', 85]] }),
  f('chicken-thigh', 'Chicken thigh, cooked', 209, 26, 0, 10.9, { satFatG: 3, serving: ['1 thigh (85 g)', 85] }),
  f('ground-beef-90', 'Ground beef 90% lean, cooked', 217, 27, 0, 11.8, { satFatG: 4.5, serving: ['3 oz (85 g)', 85] }),
  f('ground-beef-80', 'Ground beef 80% lean, cooked', 254, 26, 0, 16.2, { satFatG: 6.2, serving: ['3 oz (85 g)', 85] }),
  f('sirloin-steak', 'Sirloin steak, cooked', 212, 29, 0, 10, { satFatG: 3.9, serving: ['4 oz (113 g)', 113] }),
  f('pork-chop', 'Pork chop, cooked', 211, 26, 0, 11, { satFatG: 3.8, serving: ['1 chop (145 g)', 145] }),
  f('bacon', 'Bacon, cooked', 541, 37, 1.4, 42, { satFatG: 14, sodiumMg: 1717, serving: ['2 slices (16 g)', 16] }),
  f('turkey-breast', 'Turkey breast, roasted', 147, 30, 0, 2.1, { sodiumMg: 99, serving: ['3 oz (85 g)', 85] }),
  f('salmon', 'Salmon, cooked', 206, 22, 0, 12.4, { satFatG: 2.5, potassiumMg: 384, serving: ['1 fillet (170 g)', 170] }),
  f('smoked-salmon', 'Smoked salmon', 117, 18.3, 0, 4.3, { sodiumMg: 672, serving: ['2 oz (57 g)', 57] }),
  f('tuna-canned', 'Tuna, canned in water', 116, 25.5, 0, 0.8, { sodiumMg: 338, serving: ['1 can drained (142 g)', 142] }),
  f('shrimp', 'Shrimp, cooked', 99, 24, 0.2, 0.3, { sodiumMg: 111, serving: ['3 oz (85 g)', 85] }),
  f('cod', 'Cod, cooked', 105, 23, 0, 0.9, { serving: ['1 fillet (180 g)', 180] }),
  f('egg', 'Egg, whole', 143, 12.6, 0.7, 9.5, { satFatG: 3.1, sodiumMg: 142, servings: [['1 large (50 g)', 50], ['2 large (100 g)', 100], ['3 large (150 g)', 150]] }),
  f('egg-white', 'Egg white', 52, 10.9, 0.7, 0.2, { sodiumMg: 166, serving: ['1 large white (33 g)', 33] }),
  f('tofu-firm', 'Tofu, firm', 76, 8, 1.9, 4.8, { serving: ['1/2 block (150 g)', 150] }),

  // Dairy
  f('milk-whole', 'Milk, whole', 61, 3.2, 4.8, 3.3, { sugarG: 5.1, satFatG: 1.9, serving: ['1 cup (244 g)', 244] }),
  f('milk-2pct', 'Milk, 2%', 50, 3.3, 4.8, 2, { sugarG: 5.1, satFatG: 1.3, serving: ['1 cup (244 g)', 244] }),
  f('milk-skim', 'Milk, skim', 34, 3.4, 5, 0.1, { sugarG: 5.1, serving: ['1 cup (245 g)', 245] }),
  f('greek-yogurt-nonfat', 'Greek yogurt, nonfat', 59, 10.2, 3.6, 0.4, { sugarG: 3.2, serving: ['1 cup (227 g)', 227] }),
  f('greek-yogurt-whole', 'Greek yogurt, whole milk', 97, 9, 3.9, 5, { sugarG: 4, satFatG: 3.2, serving: ['1 cup (227 g)', 227] }),
  f('cottage-cheese', 'Cottage cheese, 2%', 84, 11, 4.3, 2.3, { sodiumMg: 330, serving: ['1/2 cup (113 g)', 113] }),
  f('cheddar', 'Cheddar cheese', 403, 23, 1.3, 33, { satFatG: 19, sodiumMg: 653, serving: ['1 slice (28 g)', 28] }),
  f('mozzarella', 'Mozzarella, part-skim', 254, 24, 3, 16, { satFatG: 10, sodiumMg: 619, serving: ['1 oz (28 g)', 28] }),
  f('butter', 'Butter', 717, 0.9, 0.1, 81, { satFatG: 51, sodiumMg: 643, servings: [['1 tbsp (14 g)', 14], ['1 tsp (5 g)', 5]] }),
  f('whey-protein', 'Whey protein powder', 375, 75, 12.5, 6, { serving: ['1 scoop (31 g)', 31] }),

  // Grains & starches
  f('white-rice', 'White rice, cooked', 130, 2.7, 28.2, 0.3, { serving: ['1 cup (158 g)', 158] }),
  f('brown-rice', 'Brown rice, cooked', 112, 2.6, 23.5, 0.9, { fiberG: 1.8, serving: ['1 cup (195 g)', 195] }),
  f('oats-dry', 'Oats, dry', 379, 13.2, 67.7, 6.5, { fiberG: 10.1, sugarG: 1, servings: [['1/2 cup (40 g)', 40], ['1 cup (80 g)', 80]] }),
  f('pasta', 'Pasta, cooked', 158, 5.8, 30.9, 0.9, { fiberG: 1.8, serving: ['1 cup (140 g)', 140] }),
  f('white-bread', 'White bread', 265, 9, 49, 3.2, { fiberG: 2.7, sugarG: 5, sodiumMg: 491, serving: ['1 slice (28 g)', 28] }),
  f('whole-wheat-bread', 'Whole wheat bread', 252, 12.3, 42.7, 3.5, { fiberG: 6, sugarG: 4.3, sodiumMg: 450, serving: ['1 slice (32 g)', 32] }),
  f('bagel', 'Bagel, plain', 250, 10, 48.9, 1.5, { fiberG: 2.1, sodiumMg: 430, serving: ['1 bagel (105 g)', 105] }),
  f('flour-tortilla', 'Flour tortilla', 306, 8.2, 48.9, 8, { sodiumMg: 736, serving: ['1 tortilla (49 g)', 49] }),
  f('corn-tortilla', 'Corn tortilla', 218, 5.7, 44.6, 2.9, { fiberG: 6.3, serving: ['1 tortilla (26 g)', 26] }),
  f('quinoa', 'Quinoa, cooked', 120, 4.4, 21.3, 1.9, { fiberG: 2.8, serving: ['1 cup (185 g)', 185] }),
  f('potato-baked', 'Potato, baked', 93, 2.5, 21.2, 0.1, { fiberG: 2.2, potassiumMg: 535, serving: ['1 medium (173 g)', 173] }),
  f('sweet-potato', 'Sweet potato, baked', 90, 2, 20.7, 0.2, { fiberG: 3.3, sugarG: 6.5, potassiumMg: 475, serving: ['1 medium (114 g)', 114] }),
  f('corn-flakes', 'Corn flakes cereal', 357, 7.5, 84, 0.4, { sugarG: 9.5, sodiumMg: 729, serving: ['1 cup (28 g)', 28] }),
  f('granola', 'Granola', 471, 10, 64, 20, { fiberG: 5.3, sugarG: 24, serving: ['1/2 cup (55 g)', 55] }),
  f('rice-cake', 'Rice cake, plain', 387, 8.2, 81.5, 2.8, { serving: ['1 cake (9 g)', 9] }),

  // Fruit
  f('apple', 'Apple', 52, 0.3, 13.8, 0.2, { fiberG: 2.4, sugarG: 10.4, serving: ['1 medium (182 g)', 182] }),
  f('banana', 'Banana', 89, 1.1, 22.8, 0.3, { fiberG: 2.6, sugarG: 12.2, potassiumMg: 358, serving: ['1 medium (118 g)', 118] }),
  f('orange', 'Orange', 47, 0.9, 11.8, 0.1, { fiberG: 2.4, sugarG: 9.4, serving: ['1 medium (131 g)', 131] }),
  f('strawberries', 'Strawberries', 32, 0.7, 7.7, 0.3, { fiberG: 2, sugarG: 4.9, serving: ['1 cup (152 g)', 152] }),
  f('blueberries', 'Blueberries', 57, 0.7, 14.5, 0.3, { fiberG: 2.4, sugarG: 10, serving: ['1 cup (148 g)', 148] }),
  f('grapes', 'Grapes', 69, 0.7, 18.1, 0.2, { sugarG: 15.5, serving: ['1 cup (151 g)', 151] }),
  f('watermelon', 'Watermelon', 30, 0.6, 7.6, 0.2, { sugarG: 6.2, serving: ['1 cup diced (152 g)', 152] }),
  f('avocado', 'Avocado', 160, 2, 8.5, 14.7, { fiberG: 6.7, satFatG: 2.1, potassiumMg: 485, servings: [['1/2 avocado (100 g)', 100], ['1 avocado (200 g)', 200]] }),
  f('mango', 'Mango', 60, 0.8, 15, 0.4, { fiberG: 1.6, sugarG: 13.7, serving: ['1 cup pieces (165 g)', 165] }),
  f('pineapple', 'Pineapple', 50, 0.5, 13.1, 0.1, { fiberG: 1.4, sugarG: 9.9, serving: ['1 cup chunks (165 g)', 165] }),
  f('orange-juice', 'Orange juice', 45, 0.7, 10.4, 0.2, { sugarG: 8.4, potassiumMg: 200, serving: ['1 cup (248 g)', 248] }),

  // Vegetables
  f('broccoli', 'Broccoli, raw', 34, 2.8, 6.6, 0.4, { fiberG: 2.6, potassiumMg: 316, serving: ['1 cup chopped (91 g)', 91] }),
  f('spinach', 'Spinach, raw', 23, 2.9, 3.6, 0.4, { fiberG: 2.2, potassiumMg: 558, serving: ['2 cups (60 g)', 60] }),
  f('carrot', 'Carrot', 41, 0.9, 9.6, 0.2, { fiberG: 2.8, sugarG: 4.7, serving: ['1 medium (61 g)', 61] }),
  f('tomato', 'Tomato', 18, 0.9, 3.9, 0.2, { fiberG: 1.2, potassiumMg: 237, serving: ['1 medium (123 g)', 123] }),
  f('cucumber', 'Cucumber', 15, 0.7, 3.6, 0.1, { serving: ['1/2 cucumber (150 g)', 150] }),
  f('bell-pepper', 'Bell pepper', 31, 1, 6, 0.3, { fiberG: 2.1, sugarG: 4.2, serving: ['1 medium (119 g)', 119] }),
  f('onion', 'Onion', 40, 1.1, 9.3, 0.1, { fiberG: 1.7, sugarG: 4.2, serving: ['1 medium (110 g)', 110] }),
  f('romaine', 'Romaine lettuce', 17, 1.2, 3.3, 0.3, { fiberG: 2.1, serving: ['2 cups shredded (94 g)', 94] }),
  f('green-beans', 'Green beans', 31, 1.8, 7, 0.2, { fiberG: 2.7, serving: ['1 cup (100 g)', 100] }),
  f('corn', 'Corn, sweet', 86, 3.3, 18.7, 1.4, { fiberG: 2, sugarG: 6.3, serving: ['1 ear (90 g)', 90] }),
  f('peas', 'Green peas', 81, 5.4, 14.5, 0.4, { fiberG: 5.1, serving: ['1/2 cup (80 g)', 80] }),
  f('mushrooms', 'Mushrooms, white', 22, 3.1, 3.3, 0.3, { fiberG: 1, serving: ['1 cup sliced (70 g)', 70] }),
  f('zucchini', 'Zucchini', 17, 1.2, 3.1, 0.3, { fiberG: 1, serving: ['1 medium (196 g)', 196] }),
  f('cauliflower', 'Cauliflower', 25, 1.9, 5, 0.3, { fiberG: 2, serving: ['1 cup chopped (107 g)', 107] }),
  f('asparagus', 'Asparagus', 20, 2.2, 3.9, 0.1, { fiberG: 2.1, serving: ['6 spears (90 g)', 90] }),

  // Nuts, seeds, fats
  f('almonds', 'Almonds', 579, 21.2, 21.6, 49.9, { fiberG: 12.5, satFatG: 3.8, servings: [['1 oz / handful (28 g)', 28], ['1/4 cup (36 g)', 36]] }),
  f('peanut-butter', 'Peanut butter', 588, 25, 20, 50, { fiberG: 6, sugarG: 9.2, satFatG: 10, sodiumMg: 426, servings: [['2 tbsp (32 g)', 32], ['1 tbsp (16 g)', 16]] }),
  f('peanuts', 'Peanuts', 567, 25.8, 16.1, 49.2, { fiberG: 8.5, satFatG: 6.3, serving: ['1 oz (28 g)', 28] }),
  f('walnuts', 'Walnuts', 654, 15.2, 13.7, 65.2, { fiberG: 6.7, serving: ['1 oz (28 g)', 28] }),
  f('cashews', 'Cashews', 553, 18.2, 30.2, 43.8, { fiberG: 3.3, satFatG: 7.8, serving: ['1 oz (28 g)', 28] }),
  f('chia-seeds', 'Chia seeds', 486, 16.5, 42.1, 30.7, { fiberG: 34.4, serving: ['1 tbsp (12 g)', 12] }),
  f('olive-oil', 'Olive oil', 884, 0, 0, 100, { satFatG: 13.8, servings: [['1 tbsp (14 g)', 14], ['1 tsp (4.5 g)', 4.5]] }),

  // Legumes
  f('black-beans', 'Black beans, cooked', 132, 8.9, 23.7, 0.5, { fiberG: 8.7, serving: ['1/2 cup (86 g)', 86] }),
  f('chickpeas', 'Chickpeas, cooked', 164, 8.9, 27.4, 2.6, { fiberG: 7.6, serving: ['1/2 cup (82 g)', 82] }),
  f('lentils', 'Lentils, cooked', 116, 9, 20.1, 0.4, { fiberG: 7.9, serving: ['1/2 cup (99 g)', 99] }),
  f('edamame', 'Edamame', 121, 11.9, 8.9, 5.2, { fiberG: 5.2, serving: ['1 cup (155 g)', 155] }),
  f('hummus', 'Hummus', 166, 7.9, 14.3, 9.6, { fiberG: 6, sodiumMg: 379, serving: ['2 tbsp (30 g)', 30] }),

  // Misc
  f('honey', 'Honey', 304, 0.3, 82.4, 0, { sugarG: 82.1, serving: ['1 tbsp (21 g)', 21] }),
  f('sugar', 'Sugar, white', 387, 0, 100, 0, { sugarG: 100, serving: ['1 tsp (4 g)', 4] }),
  f('dark-chocolate', 'Dark chocolate, 70%', 598, 7.8, 45.9, 42.6, { fiberG: 10.9, sugarG: 24, satFatG: 24.5, serving: ['2 squares (20 g)', 20] }),
  f('ketchup', 'Ketchup', 101, 1, 25.8, 0.1, { sugarG: 21.3, sodiumMg: 907, serving: ['1 tbsp (17 g)', 17] }),
  f('mayonnaise', 'Mayonnaise', 680, 1, 0.6, 75, { satFatG: 11.8, sodiumMg: 635, serving: ['1 tbsp (13 g)', 13] }),
];
