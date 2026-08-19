import { eq, gt } from 'drizzle-orm';

import { db } from '@/db/client';
import { foods, logEntries, settings, targets, weights } from '@/db/schema';
import { prefs } from '@/lib/storage';
import { supabase } from '@/services/supabase';

/**
 * Two-way sync between the on-device SQLite database and Supabase.
 *
 * SQLite stays the source of truth for the UI; sync is a background mirror:
 *  - pull first: server rows with updated_at past our cursor merge in,
 *    newest updatedAt wins (same rule as backup import)
 *  - push second: local rows touched since the last push are upserted
 *  - soft deletes travel as ordinary rows (deleted_at tombstones)
 *
 * Identity resolution: foods cached from a catalog (seed / OFF / USDA / AI)
 * and daily weights get independent UUIDs on each device. The server dedupes
 * them via unique (user_id, source_id) and (user_id, date); on pull, a local
 * row matching the natural key adopts the server row's id (diary references
 * to the old food id are rewritten) so devices converge on one identity.
 */

const PAGE = 500;
const SETTINGS_ID = 'singleton';

const key = (uid: string, scope: string) => `sync.${uid}.${scope}`;

function getCursor(uid: string, scope: string): number {
  return Number(prefs.getString(key(uid, scope)) ?? 0);
}
function setCursor(uid: string, scope: string, v: number) {
  prefs.set(key(uid, scope), String(v));
}

/** Forget all sync cursors (erase-all / troubleshooting): next sync re-merges everything. */
export function resetSyncCursors() {
  for (const k of prefs.getAllKeys()) if (k.startsWith('sync.')) prefs.remove(k);
}

export function getLastSyncedAt(uid: string): number | null {
  const v = prefs.getString(key(uid, 'lastSyncedAt'));
  return v ? Number(v) : null;
}

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function snakeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toSnake(k)] = v;
  return out;
}
function camelRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue; // server-only column
    out[toCamel(k)] = v;
  }
  return out;
}

interface TableCfg {
  name: 'foods' | 'log_entries' | 'weights' | 'targets';
  table: typeof foods | typeof logEntries | typeof weights | typeof targets;
  /** Server upsert conflict target for rows WITHOUT a natural key. */
  conflict: string;
  /** Cross-device identity column (adopted on pull, used as conflict target on push). */
  naturalKey?: 'sourceId' | 'date';
}

const TABLES: TableCfg[] = [
  { name: 'foods', table: foods, conflict: 'id', naturalKey: 'sourceId' },
  { name: 'weights', table: weights, conflict: 'id', naturalKey: 'date' },
  { name: 'log_entries', table: logEntries, conflict: 'id' },
  { name: 'targets', table: targets, conflict: 'id' },
];

const naturalConflict = (cfg: TableCfg) =>
  cfg.naturalKey === 'sourceId' ? 'user_id,source_id' : 'user_id,date';

// ---------------------------------------------------------------------------
// Pull

async function mergeLocal(cfg: TableCfg, row: any): Promise<number> {
  const t = cfg.table as typeof foods;
  let local = (await db.select().from(t).where(eq(t.id, row.id)))[0];

  // adopt the server identity when the same natural row exists under another uuid
  if (!local && cfg.naturalKey && row[cfg.naturalKey] != null) {
    const col = cfg.naturalKey === 'sourceId' ? (t as any).sourceId : (t as any).date;
    const twin = (await db.select().from(t).where(eq(col, row[cfg.naturalKey])))[0];
    if (twin) {
      await db.update(t).set({ id: row.id }).where(eq(t.id, twin.id));
      if (cfg.name === 'foods') {
        await db.update(logEntries).set({ foodId: row.id }).where(eq(logEntries.foodId, twin.id));
      }
      local = { ...twin, id: row.id };
    }
  }

  if (!local) {
    await db.insert(t).values(row);
    return 1;
  }
  if ((row.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    await db.update(t).set(row).where(eq(t.id, row.id));
    return 1;
  }
  return 0;
}

async function pullTable(uid: string, cfg: TableCfg): Promise<number> {
  let cursor = getCursor(uid, `pull.${cfg.name}`);
  let changed = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(cfg.name)
      .select('*')
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE);
    if (error) throw new Error(`pull ${cfg.name}: ${error.message}`);
    if (!data?.length) break;
    for (const raw of data) changed += await mergeLocal(cfg, camelRow(raw));
    cursor = Math.max(...data.map((d) => Number(d.updated_at)));
    setCursor(uid, `pull.${cfg.name}`, cursor);
    if (data.length < PAGE) break;
  }
  return changed;
}

async function pullSettings(uid: string): Promise<number> {
  const cursor = getCursor(uid, 'pull.settings');
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .gt('updated_at', cursor)
    .maybeSingle();
  if (error) throw new Error(`pull settings: ${error.message}`);
  if (!data) return 0;

  const row = { ...camelRow(data), id: SETTINGS_ID } as any;
  setCursor(uid, 'pull.settings', row.updatedAt ?? 0);
  const local = (await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)))[0];
  if (!local) {
    await db.insert(settings).values(row);
    return 1;
  }
  if ((row.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    await db.update(settings).set(row).where(eq(settings.id, SETTINGS_ID));
    return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Push

async function upsertChunked(name: string, rows: Record<string, unknown>[], conflict: string) {
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await supabase
      .from(name)
      .upsert(rows.slice(i, i + PAGE), { onConflict: conflict });
    if (error) throw new Error(`push ${name}: ${error.message}`);
  }
}

async function pushTable(uid: string, cfg: TableCfg): Promise<number> {
  const t = cfg.table as typeof foods;
  const cursor = getCursor(uid, `push.${cfg.name}`);
  const rows = await db.select().from(t).where(gt(t.updatedAt, cursor));
  if (!rows.length) return 0;

  if (cfg.naturalKey) {
    const keyed = rows.filter((r: any) => r[cfg.naturalKey!] != null);
    const bare = rows.filter((r: any) => r[cfg.naturalKey!] == null);
    if (keyed.length) await upsertChunked(cfg.name, keyed.map(snakeRow), naturalConflict(cfg));
    if (bare.length) await upsertChunked(cfg.name, bare.map(snakeRow), cfg.conflict);
  } else {
    await upsertChunked(cfg.name, rows.map(snakeRow), cfg.conflict);
  }
  setCursor(uid, `push.${cfg.name}`, Math.max(...rows.map((r: any) => r.updatedAt ?? 0)));
  return rows.length;
}

async function pushSettings(uid: string): Promise<number> {
  const cursor = getCursor(uid, 'push.settings');
  const local = (await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)))[0];
  if (!local || (local.updatedAt ?? 0) <= cursor) return 0;
  const { id: _drop, ...rest } = local as any;
  const { error } = await supabase.from('settings').upsert(snakeRow(rest), { onConflict: 'user_id' });
  if (error) throw new Error(`push settings: ${error.message}`);
  setCursor(uid, 'push.settings', local.updatedAt ?? 0);
  return 1;
}

// ---------------------------------------------------------------------------
// Orchestration

export interface SyncResult {
  pulled: number;
  pushed: number;
}

let syncing = false;

/** Full pull-then-push cycle. Throws if not signed in; no-ops if already running. */
export async function syncNow(): Promise<SyncResult> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Not signed in');
  if (syncing) return { pulled: 0, pushed: 0 };
  syncing = true;
  try {
    let pulled = 0;
    for (const cfg of TABLES) pulled += await pullTable(uid, cfg);
    pulled += await pullSettings(uid);
    let pushed = 0;
    for (const cfg of TABLES) pushed += await pushTable(uid, cfg);
    pushed += await pushSettings(uid);
    prefs.set(key(uid, 'lastSyncedAt'), String(Date.now()));
    return { pulled, pushed };
  } finally {
    syncing = false;
  }
}

/** Called by the root layout so pulls can refresh on-screen data. */
let onPulled: (() => void) | null = null;
export function setSyncInvalidator(fn: () => void) {
  onPulled = fn;
}

let lastSilentSync = 0;

/** Best-effort background sync with a foreground throttle. */
export async function syncCloudSilently(minIntervalMs = 2 * 60_000) {
  if (Date.now() - lastSilentSync < minIntervalMs) return;
  lastSilentSync = Date.now();
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const r = await syncNow();
    if (r.pulled > 0) onPulled?.();
  } catch {
    // offline or transient server error — next foreground/mutation retries
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced sync after local mutations (rapid logging batches into one push). */
export function scheduleCloudSync(delayMs = 8_000) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncCloudSilently(0);
  }, delayMs);
}
