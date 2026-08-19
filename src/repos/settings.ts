import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { settings, type Settings } from '@/db/schema';

const SINGLETON_ID = 'singleton';

export async function getSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, SINGLETON_ID) });
  if (row) return row;
  const now = Date.now();
  const fresh = { id: SINGLETON_ID, createdAt: now, updatedAt: now };
  await db.insert(settings).values(fresh).onConflictDoNothing();
  return (await db.query.settings.findFirst({ where: eq(settings.id, SINGLETON_ID) }))!;
}

export async function updateSettings(
  patch: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await getSettings();
  await db
    .update(settings)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(settings.id, SINGLETON_ID));
}
