import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getRecentSummaries, getSummaryByDate, type DailySummary } from '@/services/database';

// ── Types ──────────────────────────────────────────────────────────────────

interface ChartDay {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildChartData(summaries: DailySummary[], today: string): ChartDay[] {
  const map = new Map(summaries.map((s) => [s.date, s.total_count]));
  const days: ChartDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    days.push({
      date,
      label: DAY_LETTERS[d.getDay()],
      count: map.get(date) ?? 0,
      isToday: date === today,
    });
  }
  return days;
}

function computeStreak(summaries: DailySummary[], today: string): number {
  const map = new Map(summaries.map((s) => [s.date, s.total_count]));
  let streak = 0;
  const cursor = new Date(today);
  while (true) {
    const date = cursor.toISOString().slice(0, 10);
    const count = map.get(date) ?? 0;
    if (count === 0) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > summaries.length) break;
  }
  return streak;
}

// ── BarChart ───────────────────────────────────────────────────────────────

const MAX_BAR_HEIGHT = 100;
const MIN_BAR_HEIGHT = 3;

function BarChart({ data }: { data: ChartDay[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <View style={chartStyles.container}>
      {data.map((day) => {
        const barHeight = Math.max(
          MIN_BAR_HEIGHT,
          (day.count / maxCount) * MAX_BAR_HEIGHT,
        );
        return (
          <View key={day.date} style={chartStyles.column}>
            <Text style={chartStyles.countLabel}>
              {day.count > 0 ? day.count : ''}
            </Text>
            <View
              style={[
                chartStyles.bar,
                { height: barHeight },
                day.isToday ? chartStyles.barToday : chartStyles.barPast,
              ]}
            />
            <Text
              style={[
                chartStyles.dayLabel,
                day.isToday && chartStyles.dayLabelToday,
              ]}
            >
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 4,
    gap: 6,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  countLabel: {
    fontFamily: Fonts.ui,
    fontSize: 10,
    color: Colors.textMuted,
    height: 14,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  barToday: {
    backgroundColor: Colors.gold,
  },
  barPast: {
    backgroundColor: Colors.surfaceElevated,
  },
  dayLabel: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    color: Colors.textMuted,
  },
  dayLabelToday: {
    color: Colors.gold,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [chartData, setChartData] = useState<ChartDay[]>([]);

  useFocusEffect(
    useCallback(() => {
      const today = todayString();
      const summaries = getRecentSummaries(30);
      const todaySummary = getSummaryByDate(today);

      setTodayCount(todaySummary?.total_count ?? 0);
      setStreak(computeStreak(summaries, today));
      setChartData(buildChartData(summaries, today));
    }, []),
  );

  const isEmpty = todayCount === 0 && streak === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>TODAY</Text>
        <Text style={styles.todayCount}>{todayCount}</Text>
        <Text style={styles.phraseLabel}>Astaghfirullah</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>STREAK</Text>
        <View style={styles.streakRow}>
          <Text style={styles.streakCount}>{streak}</Text>
          <Text style={styles.streakUnit}>{streak === 1 ? 'day' : 'days'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
        <BarChart data={chartData} />
      </View>

      {isEmpty && (
        <Text style={styles.emptyHint}>
          No sessions yet — tap the mic to start
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  todayCount: {
    fontFamily: Fonts.display,
    fontSize: 64,
    color: Colors.gold,
    lineHeight: 72,
  },
  phraseLabel: {
    fontFamily: Fonts.displayLight,
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  streakCount: {
    fontFamily: Fonts.display,
    fontSize: 48,
    color: Colors.textPrimary,
    lineHeight: 56,
  },
  streakUnit: {
    fontFamily: Fonts.ui,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyHint: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
