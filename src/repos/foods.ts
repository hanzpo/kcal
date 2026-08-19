import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { foods, logEntries, type Food, type NewFood } from '@/db/schema';
import { newId } from '@/lib/ids';

const alive = isNull(foods.deletedAt);

export async function getFood(id: string): Promise<Food | undefined> {
  return db.query.foods.findFirst({ where: and(eq(foods.id, id), alive) });
}

export async function getFoodByBarcode(barcode: string): Promise<Food | undefined> {
  return db.query.foods.findFirst({ where: and(eq(foods.barcode, barcode), alive) });
}

export async function getFoodBySource(source: Food['source'], sourceId: string): Promise<Food | undefined> {
  return db.query.foods.findFirst({
    where: and(eq(foods.source, source), eq(foods.sourceId, sourceId), alive),
  });
}

/** Exact-name AI food match (case-insensitive) so repeat AI meals dedupe. */
export async function getAiFoodByName(name: string): Promise<Food | undefined> {
  return db.query.foods.findFirst({
    where: and(eq(foods.source, 'ai'), sql`lower(${foods.name}) = lower(${name})`, alive),
  });
}

export async function searchLocalFoods(query: string, limit = 25): Promise<Food[]> {
  const q = `%${query.trim().replace(/\s+/g, '%')}%`;
  return db.query.foods.findMany({
    where: and(alive, or(like(foods.name, q), like(foods.brand, q))),
    orderBy: [desc(foods.useCount), desc(foods.lastUsedAt)],
    limit,
  });
}

export async function getRecentFoods(limit = 12): Promise<Food[]> {
  return db.query.foods.findMany({
    where: and(alive, sql`${foods.lastUsedAt} is not null`),
    orderBy: [desc(foods.lastUsedAt)],
    limit,
  });
}

export async function getFrequentFoods(limit = 12): Promise<Food[]> {
  return db.query.foods.findMany({
    where: and(alive, sql`${foods.useCount} > 0`),
    orderBy: [desc(foods.useCount)],
    limit,
  });
}

export async function getFavoriteFoods(): Promise<Food[]> {
  return db.query.foods.findMany({
    where: and(alive, eq(foods.isFavorite, 1)),
    orderBy: [desc(foods.lastUsedAt)],
  });
}

/**
 * Foods historically logged around this hour of day ("hourly go-tos"):
 * ranks by how often the food appears within ±90 min of the given hour.
 */
export async function getFoodsForHour(hour: number, limit = 8): Promise<Food[]> {
  const rows = await db
    .select({ food: foods, n: sql<number>`count(*)`.as('n') })
    .from(logEntries)
    .innerJoin(foods, eq(logEntries.foodId, foods.id))
    .where(
      and(
        isNull(logEntries.deletedAt),
        alive,
        sql`abs(cast(strftime('%H', ${logEntries.createdAt} / 1000, 'unixepoch', 'localtime') as integer) - ${hour}) <= 1`,
      ),
    )
    .groupBy(foods.id)
    .orderBy(desc(sql`n`))
    .limit(limit);
  return rows.map((r) => r.food);
}

export type FoodInput = Omit<NewFood, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function insertFood(input: FoodInput): Promise<Food> {
  const now = Date.now();
  const row: NewFood = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(foods).values(row);
  return (await getFood(row.id!))!;
}

/**
 * Cache an external/AI food, deduping on (source, sourceId) or barcode.
 * Returns the existing row when found (refreshing nutrition data).
 */
export async function upsertCachedFood(input: FoodInput): Promise<Food> {
  const existing =
    (input.sourceId ? await getFoodBySource(input.source, input.sourceId) : undefined) ??
    (input.barcode ? await getFoodByBarcode(input.barcode) : undefined);
  if (existing) {
    await db
      .update(foods)
      .set({ ...input, updatedAt: Date.now() })
      .where(eq(foods.id, existing.id));
    return (await getFood(existing.id))!;
  }
  return insertFood(input);
}

export async function updateFood(id: string, patch: Partial<FoodInput>): Promise<void> {
  await db.update(foods).set({ ...patch, updatedAt: Date.now() }).where(eq(foods.id, id));
}

export async function markFoodUsed(id: string): Promise<void> {
  await db
    .update(foods)
    .set({ lastUsedAt: Date.now(), useCount: sql`${foods.useCount} + 1`, updatedAt: Date.now() })
    .where(eq(foods.id, id));
}

export async function toggleFavorite(id: string): Promise<void> {
  await db
    .update(foods)
    .set({ isFavorite: sql`1 - ${foods.isFavorite}`, updatedAt: Date.now() })
    .where(eq(foods.id, id));
}

export async function softDeleteFood(id: string): Promise<void> {
  const now = Date.now();
  await db.update(foods).set({ deletedAt: now, updatedAt: now }).where(eq(foods.id, id));
}
