import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { localDate } from './dates.ts';
export { localDate } from './dates.ts';

const isWeb = Platform.OS === 'web';
let db: SQLite.SQLiteDatabase | null = null;

// ── Types ──────────────────────────────────────────────────────────────────

export interface Session {
  id: number;
  local_id: string;
  started_at: number;
  ended_at: number | null;
  count: number;
  phrase_id: string;
  mood: string | null;
  synced: number; // 0 | 1
}

export interface DailySummary {
  id: number;
  date: string; // YYYY-MM-DD
  total_count: number;
  session_count: number;
  peak_period: string | null;
  dominant_mood: string | null;
}

// ── Schema ─────────────────────────────────────────────────────────────────

export function initDatabase(): void {
  if (isWeb) return;
  db ??= SQLite.openDatabaseSync('wirdd.db');
  db!.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      local_id     TEXT    UNIQUE NOT NULL,
      started_at   INTEGER NOT NULL,
      local_date   TEXT,
      ended_at     INTEGER,
      count        INTEGER NOT NULL DEFAULT 0,
      phrase_id    TEXT    NOT NULL DEFAULT 'astaghfirullah',
      mood         TEXT,
      synced       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT    UNIQUE NOT NULL,
      total_count    INTEGER NOT NULL DEFAULT 0,
      session_count  INTEGER NOT NULL DEFAULT 0,
      peak_period    TEXT,
      dominant_mood  TEXT
    );
    CREATE TABLE IF NOT EXISTS count_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_id TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      local_date TEXT,
      delta INTEGER NOT NULL CHECK(delta IN (-1, 1))
    );
    CREATE INDEX IF NOT EXISTS count_events_day ON count_events(occurred_at);
  `);
  db!.withTransactionSync(() => {
    // Pin historical days when written so changing timezone cannot move counts.
    for (const [table, timestamp] of [['sessions', 'started_at'], ['count_events', 'occurred_at']] as const) {
      const columns = db!.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
      if (!columns.some(column => column.name === 'local_date')) db!.execSync(`ALTER TABLE ${table} ADD COLUMN local_date TEXT`);
      const rows = db!.getAllSync<{ id: number; timestamp: number }>(`SELECT id, ${timestamp} AS timestamp FROM ${table} WHERE local_date IS NULL`);
      for (const row of rows) db!.runSync(`UPDATE ${table} SET local_date = ? WHERE id = ?`, [localDate(row.timestamp), row.id]);
    }
    db!.execSync('CREATE INDEX IF NOT EXISTS count_events_local_date ON count_events(local_date); CREATE INDEX IF NOT EXISTS sessions_local_date ON sessions(local_date);');
  });
}

// Atomic event + count update. An interrupted process can recover exactly the
// committed count; no in-memory count is treated as durable truth.
export function changeSessionCount(localId: string, delta: -1 | 1): number {
  if (isWeb) return 0;
  let count = 0;
  const now = Date.now();
  let eventTime = now;
  let eventDate = localDate(now);
  db!.withTransactionSync(() => {
    const current = db!.getFirstSync<Pick<Session, 'count'>>(
      'SELECT count FROM sessions WHERE local_id = ? AND ended_at IS NULL', [localId],
    );
    if (!current) throw new Error('Session is no longer active');
    count = Math.max(0, current.count + delta);
    if (count === current.count) return;
    if (delta === -1) {
      const events = db!.getAllSync<{ occurred_at: number; local_date: string; delta: number }>(
        'SELECT occurred_at, local_date, delta FROM count_events WHERE local_id = ? ORDER BY id', [localId],
      );
      const unmatched: { occurred_at: number; local_date: string }[] = [];
      for (const event of events) {
        if (event.delta === 1) unmatched.push(event);
        else unmatched.pop();
      }
      const original = unmatched.at(-1);
      eventTime = original?.occurred_at ?? now;
      eventDate = original?.local_date ?? localDate(eventTime);
    }
    db!.runSync('UPDATE sessions SET count = ? WHERE local_id = ?', [count, localId]);
    db!.runSync('INSERT INTO count_events (local_id, occurred_at, local_date, delta) VALUES (?, ?, ?, ?)', [localId, eventTime, eventDate, delta]);
    // The event and the displayed daily total must commit together.
    refreshDailySummary(eventDate);
  });
  return count;
}

export function recoverInterruptedSessions(): number {
  if (isWeb) return 0;
  const open = db!.getAllSync<Session>('SELECT * FROM sessions WHERE ended_at IS NULL');
  const now = Date.now();
  db!.withTransactionSync(() => {
    db!.runSync('UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL', [now]);
    // Repair an older summary if the process died after a count was committed.
    const dates = new Set<string>([localDate(now)]);
    for (const row of db!.getAllSync<{ local_date: string }>('SELECT DISTINCT local_date FROM count_events')) {
      dates.add(row.local_date);
    }
    for (const row of db!.getAllSync<{ local_date: string }>('SELECT DISTINCT local_date FROM sessions')) {
      dates.add(row.local_date);
    }
    for (const date of dates) refreshDailySummary(date);
  });
  return open.length;
}

// ── Sessions ───────────────────────────────────────────────────────────────

export function insertSession(localId: string, startedAt: number, phraseId: string): number {
  if (isWeb) return 0;
  const result = db!.runSync(
    'INSERT INTO sessions (local_id, started_at, local_date, phrase_id) VALUES (?, ?, ?, ?)',
    [localId, startedAt, localDate(startedAt), phraseId],
  );
  return result.lastInsertRowId;
}

export function endSession(localId: string, endedAt: number, count: number, mood?: string): void {
  if (isWeb) return;
  db!.withTransactionSync(() => {
    db!.runSync(
      'UPDATE sessions SET ended_at = ?, count = ?, mood = ? WHERE local_id = ? AND ended_at IS NULL',
      [endedAt, count, mood ?? null, localId],
    );
    const session = db!.getFirstSync<{ local_date: string }>('SELECT local_date FROM sessions WHERE local_id = ?', [localId]);
    if (session) {
      refreshDailySummary(session.local_date);
      refreshDailySummary(localDate(endedAt));
    }
  });
}

export function getSessionsByDate(dateYYYYMMDD: string): Session[] {
  if (isWeb) return [];
  return db!.getAllSync<Session>(
    'SELECT * FROM sessions WHERE local_date = ? ORDER BY started_at DESC',
    [dateYYYYMMDD],
  );
}

export function getRecentSessions(limit = 10): Session[] {
  if (isWeb) return [];
  return db!.getAllSync<Session>(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?', [limit],
  );
}

export function getUnsyncedSessions(): Session[] {
  if (isWeb) return [];
  return db!.getAllSync<Session>('SELECT * FROM sessions WHERE synced = 0 AND ended_at IS NOT NULL');
}

export function markSessionSynced(localId: string): void {
  if (isWeb) return;
  db!.runSync('UPDATE sessions SET synced = 1 WHERE local_id = ?', [localId]);
}

export function updateSessionMood(localId: string, mood: string): void {
  if (isWeb) return;
  db!.runSync('UPDATE sessions SET mood = ? WHERE local_id = ?', [mood, localId]);
}

// ── Daily summaries ────────────────────────────────────────────────────────

export function upsertDailySummary(
  date: string,
  totalCount: number,
  sessionCount: number,
  peakPeriod?: string,
  dominantMood?: string,
): void {
  if (isWeb) return;
  db!.runSync(
    `INSERT INTO daily_summaries (date, total_count, session_count, peak_period, dominant_mood)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       total_count   = excluded.total_count,
       session_count = excluded.session_count,
       peak_period   = excluded.peak_period,
       dominant_mood = excluded.dominant_mood`,
    [date, totalCount, sessionCount, peakPeriod ?? null, dominantMood ?? null],
  );
}

export function getRecentSummaries(days: number): DailySummary[] {
  if (isWeb) return [];
  return db!.getAllSync<DailySummary>(
    'SELECT * FROM daily_summaries ORDER BY date DESC LIMIT ?',
    [days],
  );
}

export function getActiveSummaries(): DailySummary[] {
  if (isWeb) return [];
  return db!.getAllSync<DailySummary>('SELECT * FROM daily_summaries WHERE total_count > 0 ORDER BY date DESC');
}

// The caller must end the active session before deleting local history.
export function deleteLocalHistory(): void {
  if (isWeb) return;
  db!.withTransactionSync(() => {
    const active = db!.getFirstSync('SELECT id FROM sessions WHERE ended_at IS NULL LIMIT 1');
    if (active) throw new Error('End your active session before deleting history.');
    db!.execSync('DELETE FROM count_events; DELETE FROM sessions; DELETE FROM daily_summaries;');
  });
}

export function getSummaryByDate(date: string): DailySummary | null {
  if (isWeb) return null;
  return db!.getFirstSync<DailySummary>(
    'SELECT * FROM daily_summaries WHERE date = ?',
    [date],
  );
}

export function refreshDailySummary(dateYYYYMMDD: string): void {
  if (isWeb) return;
  const sessions = getSessionsByDate(dateYYYYMMDD);
  const events = db!.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(delta), 0) AS total FROM count_events WHERE local_date = ?',
    [dateYYYYMMDD],
  );
  // Preserve historical sessions created before count_events existed.
  const legacy = db!.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(s.count), 0) AS total FROM sessions s
     WHERE s.local_date = ?
     AND NOT EXISTS (SELECT 1 FROM count_events e WHERE e.local_id = s.local_id)`,
    [dateYYYYMMDD],
  );
  const totalCount = Math.max(0, (events?.total ?? 0) + (legacy?.total ?? 0));
  const sessionCount = sessions.length;
  upsertDailySummary(dateYYYYMMDD, totalCount, sessionCount);
}
