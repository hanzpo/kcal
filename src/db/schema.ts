import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Sync-ready conventions (for a future Supabase migration):
 * - client-generated UUID text primary keys (never autoincrement)
 * - created_at / updated_at as epoch ms, set by the app
 * - soft deletes via deleted_at (tombstones survive sync)
 * - no user_id locally; Postgres will stamp it via `default auth.uid()` + RLS
 */

const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

/** Per-100g nutrition columns, shared by foods. All optional except the big four. */
const nutritionColumns = {
  kcal: real('kcal').notNull(),
  proteinG: real('protein_g').notNull(),
  carbsG: real('carbs_g').notNull(),
  fatG: real('fat_g').notNull(),
  fiberG: real('fiber_g'),
  sugarG: real('sugar_g'),
  satFatG: real('sat_fat_g'),
  monoFatG: real('mono_fat_g'),
  polyFatG: real('poly_fat_g'),
  transFatG: real('trans_fat_g'),
  cholesterolMg: real('cholesterol_mg'),
  sodiumMg: real('sodium_mg'),
  potassiumMg: real('potassium_mg'),
  calciumMg: real('calcium_mg'),
  ironMg: real('iron_mg'),
  magnesiumMg: real('magnesium_mg'),
  zincMg: real('zinc_mg'),
  vitaminAUg: real('vitamin_a_ug'),
  vitaminCMg: real('vitamin_c_mg'),
  vitaminDUg: real('vitamin_d_ug'),
  vitaminB12Ug: real('vitamin_b12_ug'),
  folateUg: real('folate_ug'),
};

/**
 * Food catalog: cached API results (Open Food Facts / USDA), custom foods,
 * and AI-estimated foods. Nutrition is stored per 100 g; `servings` holds
 * named portions as JSON [{ name, grams }].
 */
export const foods = sqliteTable(
  'foods',
  {
    ...syncColumns,
    name: text('name').notNull(),
    brand: text('brand'),
    source: text('source', { enum: ['off', 'usda', 'custom', 'ai'] }).notNull(),
    sourceId: text('source_id'),
    barcode: text('barcode'),
    servingName: text('serving_name'),
    servingGrams: real('serving_grams'),
    servings: text('servings'),
    ...nutritionColumns,
    lastUsedAt: integer('last_used_at'),
    useCount: integer('use_count').notNull().default(0),
    isFavorite: integer('is_favorite').notNull().default(0),
  },
  (t) => [
    index('foods_barcode_idx').on(t.barcode),
    index('foods_name_idx').on(t.name),
    index('foods_last_used_idx').on(t.lastUsedAt),
  ],
);

/**
 * Food diary entries. Nutrition is SNAPSHOTTED at log time (macros as columns
 * for fast daily aggregation, full micros as JSON) so later edits to a food
 * never rewrite history. `date` is a local YYYY-MM-DD string.
 */
export const logEntries = sqliteTable(
  'log_entries',
  {
    ...syncColumns,
    date: text('date').notNull(),
    meal: text('meal', { enum: ['breakfast', 'lunch', 'dinner', 'snacks'] }).notNull(),
    foodId: text('food_id'),
    name: text('name').notNull(),
    brand: text('brand'),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    grams: real('grams'),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    micros: text('micros'),
    loggedVia: text('logged_via', {
      enum: ['search', 'barcode', 'ai_photo', 'ai_text', 'quick', 'recent', 'manual'],
    }).notNull(),
  },
  (t) => [index('log_entries_date_idx').on(t.date)],
);

/** Daily scale weights, one per local date, stored in kg. */
export const weights = sqliteTable(
  'weights',
  {
    ...syncColumns,
    date: text('date').notNull().unique(),
    weightKg: real('weight_kg').notNull(),
  },
  (t) => [index('weights_date_idx').on(t.date)],
);

/**
 * Macro target history. The newest non-deleted row by effectiveDate is the
 * active program; keeping history powers the strategy/adjustment timeline.
 */
export const targets = sqliteTable(
  'targets',
  {
    ...syncColumns,
    effectiveDate: text('effective_date').notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    /** TDEE estimate at the time this target was set (kcal/day). */
    tdeeAtSet: real('tdee_at_set'),
    /** Why the target changed: initial | weekly_checkin | manual */
    reason: text('reason', { enum: ['initial', 'weekly_checkin', 'manual'] }).notNull(),
  },
  (t) => [index('targets_effective_date_idx').on(t.effectiveDate)],
);

/** Single-row user profile + goal settings (id = 'singleton'). */
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  onboardingComplete: integer('onboarding_complete').notNull().default(0),
  sex: text('sex', { enum: ['male', 'female'] }),
  birthYear: integer('birth_year'),
  heightCm: real('height_cm'),
  activityLevel: text('activity_level', {
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  }),
  goalType: text('goal_type', { enum: ['lose', 'maintain', 'gain'] }),
  /** Signed % of bodyweight per week, e.g. -0.5 for a moderate cut. */
  goalRatePctPerWeek: real('goal_rate_pct_per_week'),
  /** Optional target bodyweight for the projection on the Coach tab. */
  goalWeightKg: real('goal_weight_kg'),
  proteinGPerKg: real('protein_g_per_kg').notNull().default(1.8),
  weightUnit: text('weight_unit', { enum: ['kg', 'lb'] })
    .notNull()
    .default('lb'),
  /** Anchor TDEE from BMR formula before enough data exists (kcal/day). */
  initialTdee: real('initial_tdee'),
  /** Date of the last automatic weekly target adjustment. */
  lastCheckinDate: text('last_checkin_date'),
});

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type LogEntry = typeof logEntries.$inferSelect;
export type NewLogEntry = typeof logEntries.$inferInsert;
export type Weight = typeof weights.$inferSelect;
export type NewWeight = typeof weights.$inferInsert;
export type Target = typeof targets.$inferSelect;
export type NewTarget = typeof targets.$inferInsert;
export type Settings = typeof settings.$inferSelect;
