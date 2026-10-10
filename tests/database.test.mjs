import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the application's SQL with real SQLite. Only the native bridge is
// replaced; transactions, corrections, migration and recovery use production code.
const directory = mkdtempSync(join(tmpdir(), 'wirdd-db-'));
const path = join(directory, 'wirdd.db');
let sql;
let failOn = null;
function open() {
  sql = new DatabaseSync(path);
  globalThis.__wirddTestDb = {
    execSync: query => sql.exec(query),
    runSync: (query, params = []) => {
      if (failOn && query.includes(failOn)) throw new Error('Simulated disk full');
      const result = sql.prepare(query).run(...params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
    },
    getFirstSync: (query, params = []) => sql.prepare(query).get(...params) ?? null,
    getAllSync: (query, params = []) => sql.prepare(query).all(...params),
    withTransactionSync: operation => {
      sql.exec('BEGIN');
      try { operation(); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
}
open();
const bridge = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native') return { shortCircuit: true, url: 'data:text/javascript,export const Platform = { OS: "android" };' };
    if (specifier === 'expo-sqlite') return { shortCircuit: true, url: 'data:text/javascript,export const openDatabaseSync = () => globalThis.__wirddTestDb;' };
    return next(specifier, context);
  },
});
let db = await import('../services/database.ts');
db.initDatabase();
const originalDay = db.localDate();

test('SQLite durability and summary consistency', async t => {
  t.after(() => {
    sql.close();
    bridge.deregister();
    delete globalThis.__wirddTestDb;
    rmSync(directory, { recursive: true, force: true });
  });

  await t.test('count, event and daily total commit together; corrections floor at zero', () => {
    db.insertSession('normal', Date.now(), 'astaghfirullah');
    assert.equal(db.changeSessionCount('normal', 1), 1);
    assert.equal(db.changeSessionCount('normal', 1), 2);
    assert.equal(db.getSummaryByDate(db.localDate()).total_count, 2);
    assert.equal(db.changeSessionCount('normal', -1), 1);
    assert.equal(db.changeSessionCount('normal', -1), 0);
    assert.equal(db.changeSessionCount('normal', -1), 0);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM count_events').get().n, 4);
    db.endSession('normal', Date.now(), 0);
  });

  await t.test('storage failure rolls back session count, event and summary', () => {
    db.insertSession('failure', Date.now(), 'astaghfirullah');
    db.changeSessionCount('failure', 1);
    failOn = 'INSERT INTO daily_summaries';
    assert.throws(() => db.changeSessionCount('failure', 1), /disk full/);
    failOn = null;
    assert.equal(sql.prepare('SELECT count FROM sessions WHERE local_id = ?').get('failure').count, 1);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM count_events WHERE local_id = ?').get('failure').n, 1);
    assert.equal(db.getSummaryByDate(db.localDate()).total_count, 1);
  });

  await t.test('process restart restores committed counts and closes interrupted sessions exactly once', async () => {
    sql.close();
    open();
    db = await import('../services/database.ts?restart');
    db.initDatabase();
    assert.equal(db.recoverInterruptedSessions(), 1);
    assert.equal(db.recoverInterruptedSessions(), 0);
    assert.equal(db.getRecentSessions().find(s => s.local_id === 'failure').count, 1);
    assert.equal(db.getSummaryByDate(db.localDate()).total_count, 1);
    assert.throws(() => db.changeSessionCount('failure', 1), /no longer active/);
  });

  await t.test('midnight correction reverses the original day rather than today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 0, 0);
    const timestamp = yesterday.getTime();
    db.insertSession('midnight', timestamp, 'astaghfirullah');
    sql.prepare('UPDATE sessions SET count = 1 WHERE local_id = ?').run('midnight');
    sql.prepare('INSERT INTO count_events (local_id, occurred_at, local_date, delta) VALUES (?, ?, ?, 1)').run('midnight', timestamp, db.localDate(timestamp));
    db.refreshDailySummary(db.localDate(timestamp));
    assert.equal(db.getSummaryByDate(db.localDate(timestamp)).total_count, 1);
    db.changeSessionCount('midnight', -1);
    assert.equal(db.getSummaryByDate(db.localDate(timestamp)).total_count, 0);
    assert.equal(db.getSummaryByDate(db.localDate()).total_count, 1);
    db.endSession('midnight', Date.now(), 0);
  });

  await t.test('legacy history without events survives schema initialization and recovery', () => {
    db.insertSession('legacy', Date.now(), 'astaghfirullah');
    sql.prepare('UPDATE sessions SET count = 12, ended_at = ? WHERE local_id = ?').run(Date.now(), 'legacy');
    db.initDatabase();
    db.recoverInterruptedSessions();
    assert.equal(db.getSummaryByDate(db.localDate()).total_count, 13);
  });

  await t.test('timezone changes preserve original event and session days', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Karachi';
      const timestamp = new Date('2026-01-01T00:30:00+05:00').getTime();
      db.insertSession('timezone', timestamp, 'astaghfirullah');
      sql.prepare('UPDATE sessions SET count = 1 WHERE local_id = ?').run('timezone');
      sql.prepare('INSERT INTO count_events (local_id, occurred_at, local_date, delta) VALUES (?, ?, ?, 1)').run('timezone', timestamp, '2026-01-01');
      process.env.TZ = 'America/Los_Angeles';
      db.changeSessionCount('timezone', -1);
      assert.equal(db.getSummaryByDate('2026-01-01').total_count, 0);
      assert.equal(db.getSessionsByDate('2026-01-01').length, 1);
      db.endSession('timezone', Date.now(), 0);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  await t.test('deletion is blocked during a session and removes all history atomically afterwards', () => {
    db.insertSession('active', Date.now(), 'astaghfirullah');
    assert.throws(() => db.deleteLocalHistory(), /End your active session/);
    assert.equal(db.getSummaryByDate(originalDay).total_count, 13);
    db.endSession('active', Date.now(), 0);
    db.deleteLocalHistory();
    assert.deepEqual(db.getRecentSessions(), []);
    assert.deepEqual(db.getRecentSummaries(30), []);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM count_events').get().n, 0);
  });

  await t.test('upgrade from the prior schema backfills local days without losing history', () => {
    sql.exec('DROP INDEX count_events_local_date; DROP INDEX sessions_local_date; ALTER TABLE count_events DROP COLUMN local_date; ALTER TABLE sessions DROP COLUMN local_date;');
    const now = Date.now();
    sql.prepare('INSERT INTO sessions (local_id, started_at, ended_at, count) VALUES (?, ?, ?, ?)').run('old-schema', now, now, 7);
    db.initDatabase();
    db.recoverInterruptedSessions();
    assert.equal(db.getSummaryByDate(db.localDate(now)).total_count, 7);
    assert.equal(db.getSessionsByDate(db.localDate(now))[0].count, 7);
  });
});
