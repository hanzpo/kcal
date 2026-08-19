import { and, asc, between, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { logEntries, type LogEntry, type NewLogEntry } from '@/db/schema';
import { newId } from '@/lib/ids';

const alive = isNull(logEntries.deletedAt);

export async function getEntry(id: string): Promise<LogEntry | undefined> {
  return db.query.logEntries.findFirst({ where: and(eq(logEntries.id, id), alive) });
}

export async function getEntriesForDate(date: string): Promise<LogEntry[]> {
  return db.query.logEntries.findMany({
    where: and(eq(logEntries.date, date), alive),
    orderBy: [asc(logEntries.createdAt)],
  });
}

export async function getRecentEntries(limit = 10): Promise<LogEntry[]> {
  return db.query.logEntries.findMany({
    where: alive,
    orderBy: [desc(logEntries.createdAt)],
    limit,
  });
}

export interface DailyIntake {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

/** Daily intake totals for [startDate, endDate] inclusive; days with no entries are absent. */
export async function getDailyIntakes(startDate: string, endDate: string): Promise<DailyIntake[]> {
  const rows = await db
    .select({
      date: logEntries.date,
      kcal: sql<number>`sum(${logEntries.kcal})`,
      proteinG: sql<number>`sum(${logEntries.proteinG})`,
      carbsG: sql<number>`sum(${logEntries.carbsG})`,
      fatG: sql<number>`sum(${logEntries.fatG})`,
      entryCount: sql<number>`count(*)`,
    })
    .from(logEntries)
    .where(and(alive, between(logEntries.date, startDate, endDate)))
    .groupBy(logEntries.date)
    .orderBy(asc(logEntries.date));
  return rows;
}

export async function getEntriesBetween(startDate: string, endDate: string): Promise<LogEntry[]> {
  return db.query.logEntries.findMany({
    where: and(alive, between(logEntries.date, startDate, endDate)),
    orderBy: [asc(logEntries.date)],
  });
}

export type LogEntryInput = Omit<NewLogEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function insertEntry(input: LogEntryInput): Promise<LogEntry> {
  const now = Date.now();
  const row: NewLogEntry = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await db.insert(logEntries).values(row);
  return (await getEntry(row.id!))!;
}

export async function updateEntry(id: string, patch: Partial<LogEntryInput>): Promise<void> {
  await db
    .update(logEntries)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(logEntries.id, id));
}

export async function softDeleteEntry(id: string): Promise<void> {
  const now = Date.now();
  await db.update(logEntries).set({ deletedAt: now, updatedAt: now }).where(eq(logEntries.id, id));
}

/** Distinct dates (desc) that have any entries — used for streak/adherence stats. */
export async function getLoggedDates(sinceDate: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: logEntries.date })
    .from(logEntries)
    .where(and(alive, sql`${logEntries.date} >= ${sinceDate}`))
    .orderBy(desc(logEntries.date));
  return rows.map((r) => r.date);
}
