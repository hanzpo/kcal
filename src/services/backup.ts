import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import { foods, logEntries, settings, targets, weights } from '@/db/schema';
import { todayStr } from '@/lib/dates';

/**
 * Full-database JSON snapshot: the escape hatch for phone migration today and
 * the seed for Supabase sync later. Soft-deleted rows are included on purpose —
 * tombstones must survive a restore.
 */

const BACKUP_VERSION = 1;

interface Backup {
  app: 'tablet';
  version: number;
  exportedAt: string;
  foods: unknown[];
  logEntries: unknown[];
  weights: unknown[];
  targets: unknown[];
  settings: unknown[];
}

export async function buildBackup(): Promise<Backup> {
  return {
    app: 'tablet',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    foods: await db.select().from(foods),
    logEntries: await db.select().from(logEntries),
    weights: await db.select().from(weights),
    targets: await db.select().from(targets),
    settings: await db.select().from(settings),
  };
}

export async function exportAndShare(): Promise<void> {
  const backup = await buildBackup();
  const file = new File(Paths.cache, `tablet-backup-${todayStr()}.json`);
  if (file.exists) file.delete();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Tablet data' });
}

/** Restore from a backup file. Merges by row id: newest updatedAt wins. */
export async function importFromFile(): Promise<{ imported: boolean; counts?: string }> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (picked.canceled || !picked.assets?.[0]) return { imported: false };

  const raw = await new File(picked.assets[0].uri).text();
  const backup = JSON.parse(raw) as Backup;
  if (backup.app !== 'tablet' || !Array.isArray(backup.foods)) {
    throw new Error('Not a Tablet backup file.');
  }

  let total = 0;
  const tables = [
    [foods, backup.foods],
    [logEntries, backup.logEntries],
    [weights, backup.weights],
    [targets, backup.targets],
    [settings, backup.settings],
  ] as const;

  for (const [table, rows] of tables) {
    for (const row of rows as any[]) {
      const existing = await db
        .select()
        .from(table)
        .where(eq((table as any).id, row.id));
      if (existing.length === 0) {
        await db.insert(table).values(row);
        total++;
      } else if ((row.updatedAt ?? 0) > ((existing[0] as any).updatedAt ?? 0)) {
        await db.update(table).set(row).where(eq((table as any).id, row.id));
        total++;
      }
    }
  }
  return { imported: true, counts: `${total} rows` };
}
