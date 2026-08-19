import { asc, desc, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { targets, type NewTarget, type Target } from '@/db/schema';
import { newId } from '@/lib/ids';

const alive = isNull(targets.deletedAt);

/** The active program = newest target row by effective date (ties: newest created). */
export async function getActiveTarget(): Promise<Target | undefined> {
  return db.query.targets.findFirst({
    where: alive,
    orderBy: [desc(targets.effectiveDate), desc(targets.createdAt)],
  });
}

export async function getTargetHistory(): Promise<Target[]> {
  return db.query.targets.findMany({
    where: alive,
    orderBy: [asc(targets.effectiveDate), asc(targets.createdAt)],
  });
}

/** Target in effect on a given date (for historical day views). */
export async function getTargetForDate(date: string): Promise<Target | undefined> {
  const history = await getTargetHistory();
  let match: Target | undefined;
  for (const t of history) {
    if (t.effectiveDate <= date) match = t;
  }
  return match ?? history[0];
}

export type TargetInput = Omit<NewTarget, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function insertTarget(input: TargetInput): Promise<Target> {
  const now = Date.now();
  const row: NewTarget = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(targets).values(row);
  return row as Target;
}
