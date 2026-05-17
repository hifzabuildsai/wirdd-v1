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
  `);
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
  const dayStart = new Date(dateYYYYMMDD).setHours(0, 0, 0, 0);
  const dayEnd = new Date(dateYYYYMMDD).setHours(23, 59, 59, 999);
  return db!.getAllSync<Session>(
    'SELECT * FROM sessions WHERE started_at BETWEEN ? AND ? ORDER BY started_at DESC',
    [dayStart, dayEnd],
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
  const sessions = getSessionsByDate(dateYYYYMMDD);
  const completed = sessions.filter((s) => s.ended_at !== null);
  const totalCount = completed.reduce((sum, s) => sum + s.count, 0);
  const sessionCount = completed.length;
  if (sessionCount === 0) return;
  upsertDailySummary(dateYYYYMMDD, totalCount, sessionCount);
}
