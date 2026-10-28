import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, localDate, parseLocalDate } from '../services/dates.ts';

test('date-only strings remain local calendar dates in western timezones', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Asia/Karachi', 'Pacific/Auckland']) {
      process.env.TZ = zone;
      assert.equal(localDate(parseLocalDate('2026-10-10').getTime()), '2026-10-10');
      assert.equal(computeStreak([
        { date: '2026-10-10', total_count: 2 },
        { date: '2026-10-09', total_count: 1 },
      ], '2026-10-10'), 2);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('yesterday retains streak; gaps and zero counts break it', () => {
  assert.equal(computeStreak([{ date: '2026-10-09', total_count: 1 }], '2026-10-10'), 1);
  assert.equal(computeStreak([{ date: '2026-10-08', total_count: 1 }], '2026-10-10'), 0);
  assert.equal(computeStreak([
    { date: '2026-10-10', total_count: 2 },
    { date: '2026-10-09', total_count: 0 },
    { date: '2026-10-08', total_count: 3 },
  ], '2026-10-10'), 1);
});

test('streak spans over thirty days and DST transitions', () => {
  const cursor = parseLocalDate('2026-11-10');
  const days = Array.from({ length: 60 }, () => {
    const day = { date: localDate(cursor.getTime()), total_count: 1 };
    cursor.setDate(cursor.getDate() - 1);
    return day;
  });
  assert.equal(computeStreak(days, '2026-11-10'), 60);
});
