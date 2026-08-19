import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { foods } from '@/db/schema';
import { newId } from '@/lib/ids';
import { SEED_FOODS } from '@/services/seedFoods';

/** Load the bundled common-foods catalog once; idempotent via seed sourceIds. */
export async function seedFoodsIfNeeded(): Promise<void> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(foods)
    .where(sql`${foods.sourceId} like 'seed:%'`);
  if (n >= SEED_FOODS.length) return;

  const now = Date.now();
  const existing = await db
    .select({ sourceId: foods.sourceId })
    .from(foods)
    .where(sql`${foods.sourceId} like 'seed:%'`);
  const have = new Set(existing.map((r) => r.sourceId));

  const missing = SEED_FOODS.filter((f) => !have.has(f.sourceId!));
  for (const f of missing) {
    await db.insert(foods).values({ ...f, id: newId(), createdAt: now, updatedAt: now });
  }
}
