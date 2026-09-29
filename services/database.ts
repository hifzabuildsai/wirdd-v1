import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const isWeb = Platform.OS === 'web';
const db = isWeb ? null : SQLite.openDatabaseSync('wirdd.db');

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
  db!.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      local_id     TEXT    UNIQUE NOT NULL,
      started_at   INTEGER NOT NULL,
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
      delta INTEGER NOT NULL CHECK(delta IN (-1, 1))
    );
    CREATE INDEX IF NOT EXISTS count_events_day ON count_events(occurred_at);
  `);
}

export function localDate(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayBounds(date: string): [number, number] {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day).getTime();
  return [start, new Date(year, month - 1, day + 1).getTime()];
}

// Atomic event + count update. An interrupted process can recover exactly the
// committed count; no in-memory count is treated as durable truth.
export function changeSessionCount(localId: string, delta: -1 | 1): number {
  if (isWeb) return 0;
  let count = 0;
  const now = Date.now();
  let eventTime = now;
  db!.withTransactionSync(() => {
    const current = db!.getFirstSync<Pick<Session, 'count'>>(
      'SELECT count FROM sessions WHERE local_id = ? AND ended_at IS NULL', [localId],
    );
    if (!current) throw new Error('Session is no longer active');
    count = Math.max(0, current.count + delta);
    if (count === current.count) return;
    if (delta === -1) {
      const events = db!.getAllSync<{ occurred_at: number; delta: number }>(
        'SELECT occurred_at, delta FROM count_events WHERE local_id = ? ORDER BY id', [localId],
      );
      const unmatched: number[] = [];
      for (const event of events) {
        if (event.delta === 1) unmatched.push(event.occurred_at);
        else unmatched.pop();
      }
      eventTime = unmatched.at(-1) ?? now;
    }
    db!.runSync('UPDATE sessions SET count = ? WHERE local_id = ?', [count, localId]);
    db!.runSync('INSERT INTO count_events (local_id, occurred_at, delta) VALUES (?, ?, ?)', [localId, eventTime, delta]);
  });
  refreshDailySummary(localDate(eventTime));
  return count;
}

export function recoverInterruptedSessions(): number {
  if (isWeb) return 0;
  const open = db!.getAllSync<Session>('SELECT * FROM sessions WHERE ended_at IS NULL');
  const now = Date.now();
  db!.runSync('UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL', [now]);
  for (const session of open) {
    refreshDailySummary(localDate(session.started_at));
    refreshDailySummary(localDate(now));
  }
  return open.length;
}

// ── Sessions ───────────────────────────────────────────────────────────────

export function insertSession(localId: string, startedAt: number, phraseId: string): number {
  if (isWeb) return 0;
  const result = db!.runSync(
    'INSERT INTO sessions (local_id, started_at, phrase_id) VALUES (?, ?, ?)',
    [localId, startedAt, phraseId],
  );
  return result.lastInsertRowId;
}

export function endSession(localId: string, endedAt: number, count: number, mood?: string): void {
  if (isWeb) return;
  db!.runSync(
    'UPDATE sessions SET ended_at = ?, count = ?, mood = ? WHERE local_id = ?',
    [endedAt, count, mood ?? null, localId],
  );
}

export function getSessionsByDate(dateYYYYMMDD: string): Session[] {
  if (isWeb) return [];
  const [dayStart, dayEnd] = dayBounds(dateYYYYMMDD);
  return db!.getAllSync<Session>(
    'SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC',
    [dayStart, dayEnd],
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

export function getSummaryByDate(date: string): DailySummary | null {
  if (isWeb) return null;
  return db!.getFirstSync<DailySummary>(
    'SELECT * FROM daily_summaries WHERE date = ?',
    [date],
  );
}

export function refreshDailySummary(dateYYYYMMDD: string): void {
  if (isWeb) return;
  const [start, end] = dayBounds(dateYYYYMMDD);
  const sessions = getSessionsByDate(dateYYYYMMDD);
  const events = db!.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(delta), 0) AS total FROM count_events WHERE occurred_at >= ? AND occurred_at < ?',
    [start, end],
  );
  // Preserve historical sessions created before count_events existed.
  const legacy = db!.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(s.count), 0) AS total FROM sessions s
     WHERE s.started_at >= ? AND s.started_at < ?
     AND NOT EXISTS (SELECT 1 FROM count_events e WHERE e.local_id = s.local_id)`,
    [start, end],
  );
  const totalCount = Math.max(0, (events?.total ?? 0) + (legacy?.total ?? 0));
  const sessionCount = sessions.length;
  upsertDailySummary(dateYYYYMMDD, totalCount, sessionCount);
}
