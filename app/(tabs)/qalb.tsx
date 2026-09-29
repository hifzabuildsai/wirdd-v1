import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getRecentSummaries, localDate, type DailySummary } from '@/services/database';

// ── Types ──────────────────────────────────────────────────────────────────

interface WeekDay {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function todayString(): string {
  return localDate();
}

function buildWeekData(summaries: DailySummary[], today: string): WeekDay[] {
  const map = new Map(summaries.map((s) => [s.date, s.total_count]));
  const days: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = localDate(d.getTime());
    days.push({
      date,
      label: DAY_LETTERS[d.getDay()],
      count: map.get(date) ?? 0,
      isToday: date === today,
    });
  }
  return days;
}

// ── DayDot component ───────────────────────────────────────────────────────

const DOT_SIZE = 44;

function DayDot({
  day,
  maxCount,
}: {
  day: WeekDay;
  maxCount: number;
}) {
  const hasCount = day.count > 0;
  const opacity = hasCount ? 0.25 + (day.count / Math.max(maxCount, 1)) * 0.75 : 0;

  return (
    <View style={dotStyles.column}>
      <View
        style={[
          dotStyles.dot,
          day.isToday && dotStyles.dotToday,
          hasCount && {
            backgroundColor: `rgba(200, 168, 75, ${opacity})`,
          },
        ]}
      />
      <Text style={[dotStyles.countLabel, hasCount && dotStyles.countLabelActive]}>
        {hasCount ? day.count : ''}
      </Text>
      <Text style={[dotStyles.dayLabel, day.isToday && dotStyles.dayLabelToday]}>
        {day.label}
      </Text>
    </View>
  );
}

const dotStyles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotToday: {
    borderColor: Colors.gold,
    borderWidth: 2,
  },
  countLabel: {
    fontFamily: Fonts.ui,
    fontSize: 10,
    color: 'transparent',
    height: 14,
  },
  countLabelActive: {
    color: Colors.textMuted,
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

export default function QalbScreen() {
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const today = todayString();
      const summaries = getRecentSummaries(7);
      const data = buildWeekData(summaries, today);
      const map = new Map(summaries.map((s) => [s.date, s]));

      setWeekData(data);
      setWeekTotal(data.reduce((sum, d) => sum + d.count, 0));
      setWeekSessions(
        data.reduce((sum, d) => {
          const summary = map.get(d.date);
          return sum + (summary?.session_count ?? 0);
        }, 0),
      );
    }, []),
  );

  const maxCount = Math.max(...weekData.map((d) => d.count), 1);
  const isEmpty = weekTotal === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.arabicTitle}>قَلْب</Text>
        <Text style={styles.latinTitle}>QALB</Text>
      </View>

      {/* Week dot grid */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        <View style={styles.dotRow}>
          {weekData.map((day) => (
            <DayDot key={day.date} day={day} maxCount={maxCount} />
          ))}
        </View>
      </View>

      {/* Weekly summary */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>WEEK TOTAL</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{weekTotal}</Text>
            <Text style={styles.summaryUnit}>detections</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{weekSessions}</Text>
            <Text style={styles.summaryUnit}>
              {weekSessions === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
        </View>
      </View>

      {isEmpty && (
        <Text style={styles.emptyHint}>Your heart&apos;s history will appear here</Text>
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

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  arabicTitle: {
    fontFamily: Fonts.arabic,
    fontSize: 36,
    color: Colors.gold,
  },
  latinTitle: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 3,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
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
    marginBottom: 20,
  },

  // ── Dot row ───────────────────────────────────────────────────────────────
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // ── Summary ───────────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    fontFamily: Fonts.display,
    fontSize: 40,
    color: Colors.textPrimary,
    lineHeight: 48,
  },
  summaryUnit: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyHint: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
