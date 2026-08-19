import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { weights, type Weight } from '@/db/schema';
import { newId } from '@/lib/ids';

const alive = isNull(weights.deletedAt);

export async function getAllWeights(): Promise<Weight[]> {
  return db.query.weights.findMany({ where: alive, orderBy: [asc(weights.date)] });
}

export async function getLatestWeight(): Promise<Weight | undefined> {
  return db.query.weights.findFirst({ where: alive, orderBy: [desc(weights.date)] });
}

export async function getWeightForDate(date: string): Promise<Weight | undefined> {
  return db.query.weights.findFirst({ where: and(eq(weights.date, date), alive) });
}

/** Insert or replace the weigh-in for a date. Revives a soft-deleted row if present. */
export async function upsertWeight(date: string, weightKg: number): Promise<void> {
  const now = Date.now();
  const existing = await db.query.weights.findFirst({ where: eq(weights.date, date) });
  if (existing) {
    await db
      .update(weights)
      .set({ weightKg, deletedAt: null, updatedAt: now })
      .where(eq(weights.id, existing.id));
  } else {
    await db.insert(weights).values({ id: newId(), date, weightKg, createdAt: now, updatedAt: now });
  }
}

export async function softDeleteWeight(date: string): Promise<void> {
  const now = Date.now();
  const existing = await getWeightForDate(date);
  if (existing) {
    await db.update(weights).set({ deletedAt: now, updatedAt: now }).where(eq(weights.id, existing.id));
  }
}
