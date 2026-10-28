export function localDate(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

// Keep yesterday's streak until today has passed without a recitation.
export function computeStreak(summaries: { date: string; total_count: number }[], today: string): number {
  const active = new Set(summaries.filter(day => day.total_count > 0).map(day => day.date));
  const cursor = parseLocalDate(today);
  if (!active.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(localDate(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
