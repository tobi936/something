import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { Habit, todayISO, weekStartISO } from '../lib/types';

type Entry = { habit_id: string; date: string };
type Mode = 'month' | 'year';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export default function ReflectionScreen() {
  const [mode, setMode] = useState<Mode>('month');
  const [offset, setOffset] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const monthStart = todayISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = todayISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayStr = todayISO();

  const weeksInMonth = useMemo(() => {
    const set = new Set<string>();
    for (let d = 1; d <= daysInMonth; d++) {
      set.add(weekStartISO(new Date(month.getFullYear(), month.getMonth(), d)));
    }
    return set.size;
  }, [daysInMonth, month.getMonth(), month.getFullYear()]);

  const load = useCallback(async () => {
    const [start, end] =
      mode === 'year'
        ? [`${currentYear}-01-01`, `${currentYear}-12-31`]
        : [monthStart, monthEnd];

    const [{ data: hs }, { data: ent }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_entries').select('habit_id, date').gte('date', start).lte('date', end),
    ]);
    setHabits((hs as Habit[]) ?? []);
    setEntries((ent as Entry[]) ?? []);
  }, [mode, monthStart, monthEnd, currentYear]);

  useEffect(() => {
    load();
  }, [load]);

  const monthStats = useMemo(
    () =>
      habits.map((h) => {
        const mine = entries.filter((e) => e.habit_id === h.id);
        const dates = new Set(mine.map((e) => e.date));
        if (h.frequency === 'weekly') {
          const weeks = new Set(mine.map((e) => weekStartISO(new Date(e.date))));
          return { habit: h, count: weeks.size, total: weeksInMonth, dates };
        }
        return { habit: h, count: mine.length, total: daysInMonth, dates };
      }),
    [habits, entries, daysInMonth, weeksInMonth],
  );

  const yearStats = useMemo(
    () =>
      habits.map((h) => {
        const mine = entries.filter((e) => e.habit_id === h.id);
        const monthly = Array(12).fill(0) as number[];
        mine.forEach((e) => {
          monthly[parseInt(e.date.slice(5, 7), 10) - 1]++;
        });
        return { habit: h, monthly, yearTotal: mine.length };
      }),
    [habits, entries],
  );

  const shownMonth = monthStats.filter((s) => s.count > 0 || !s.habit.archived);
  const shownYear = yearStats.filter((s) => s.yearTotal > 0 || !s.habit.archived);
  const monthLabel = month.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle subtitle="Schau zurück. Die Zahlen sind deine.">Rückblick</ScreenTitle>

      <View style={styles.toggle}>
        {(['month', 'year'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.toggleBtn, mode === m && styles.toggleBtnOn]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>
              {m === 'month' ? 'Monat' : 'Jahr'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'month' ? (
        <>
          <View style={styles.nav}>
            <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12}>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthHeading}>{monthLabel}</Text>
            <Pressable
              onPress={() => setOffset((o) => Math.min(o + 1, 0))}
              hitSlop={12}
              disabled={offset >= 0}
            >
              <Text style={[styles.arrow, offset >= 0 && styles.arrowOff]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalNum}>{entries.length}</Text>
            <Muted style={styles.totalSub}>Einträge</Muted>
          </View>

          {shownMonth.length === 0 ? (
            <Muted>Noch keine Gewohnheiten getrackt.</Muted>
          ) : (
            <>
              <SectionLabel>Score</SectionLabel>
              <Card>
                {shownMonth.map((s, i) => {
                  const days = Array.from({ length: daysInMonth }, (_, idx) => {
                    const day = idx + 1;
                    const dateStr = `${monthStart.slice(0, 7)}-${String(day).padStart(2, '0')}`;
                    return { day, dateStr, future: dateStr > todayStr, checked: s.dates.has(dateStr) };
                  });

                  return (
                    <View
                      key={s.habit.id}
                      style={[styles.habitBlock, i < shownMonth.length - 1 && styles.divider]}
                    >
                      <View style={styles.habitHeader}>
                        <View style={[styles.colorDot, { backgroundColor: s.habit.color }]} />
                        <Text style={styles.habitName}>{s.habit.name}</Text>
                        <Text style={styles.scoreNum}>
                          {s.count}
                          <Text style={styles.outOf}> / {s.total}</Text>
                        </Text>
                      </View>
                      <View style={styles.dotRow}>
                        {days.map(({ day, checked, future }) => (
                          <View
                            key={day}
                            style={[
                              styles.dot,
                              checked && { backgroundColor: s.habit.color },
                              !checked && future && styles.dotFuture,
                              !checked && !future && styles.dotMissed,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.yearHeadRow}>
            <Text style={styles.yearHeading}>{currentYear}</Text>
            <Muted style={styles.yearTotalLabel}>{entries.length} Einträge</Muted>
          </View>

          {shownYear.length === 0 ? (
            <Muted>Noch keine Gewohnheiten getrackt.</Muted>
          ) : (
            <View style={[theme.shadow, styles.tableShadow]}>
              <View style={styles.tableClip}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Header row */}
                    <View style={[styles.yearRow, styles.yearHeaderRow]}>
                      <View style={styles.nameCol} />
                      {MONTHS_DE.map((m, idx) => (
                        <Text
                          key={idx}
                          style={[
                            styles.cell,
                            styles.cellHeader,
                            idx === now.getMonth() && styles.cellAccent,
                          ]}
                        >
                          {m}
                        </Text>
                      ))}
                      <Text style={[styles.cell, styles.cellHeader, styles.cellSum]}>∑</Text>
                    </View>

                    {/* Habit rows */}
                    {shownYear.map((s, i) => (
                      <View
                        key={s.habit.id}
                        style={[styles.yearRow, i < shownYear.length - 1 && styles.divider]}
                      >
                        <View style={styles.nameCol}>
                          <View style={[styles.colorDot, { backgroundColor: s.habit.color }]} />
                          <Text style={styles.yearHabitName} numberOfLines={1}>
                            {s.habit.name}
                          </Text>
                        </View>
                        {s.monthly.map((count, idx) => (
                          <Text
                            key={idx}
                            style={[
                              styles.cell,
                              idx === now.getMonth() && styles.cellAccent,
                              count === 0 && styles.cellZero,
                            ]}
                          >
                            {count > 0 ? count : '·'}
                          </Text>
                        ))}
                        <Text style={[styles.cell, styles.cellSum, s.yearTotal > 0 && styles.cellSumActive]}>
                          {s.yearTotal}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </>
      )}

      <Muted style={styles.foot}>
        Kein Score sagt dir, ob das gut oder schlecht ist. Du weisst es selbst.
      </Muted>
      <View style={{ height: theme.spacing(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },

  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    marginBottom: theme.spacing(2.5),
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  toggleBtnOn: { backgroundColor: theme.colors.accentSoft },
  toggleText: {
    fontSize: theme.font.small,
    color: theme.colors.muted,
    fontFamily: theme.family.medium,
  },
  toggleTextOn: { color: theme.colors.text, fontFamily: theme.family.semibold },

  // Month nav
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  arrow: { fontSize: 30, color: theme.colors.text, paddingHorizontal: theme.spacing(2) },
  arrowOff: { color: theme.colors.faint },
  monthHeading: {
    fontSize: theme.font.heading,
    color: theme.colors.text,
    fontFamily: theme.family.semibold,
  },

  // Total count
  totalBox: { alignItems: 'center', marginBottom: theme.spacing(3) },
  totalNum: {
    fontSize: 56,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -2,
    lineHeight: 60,
  },
  totalSub: { fontSize: theme.font.small, marginTop: 2 },

  // Habit block (dot calendar)
  habitBlock: { paddingVertical: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  habitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  habitName: {
    flex: 1,
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.medium,
  },
  scoreNum: { fontSize: 20, color: theme.colors.text, fontFamily: theme.family.bold },
  outOf: { fontSize: theme.font.body, color: theme.colors.faint, fontFamily: theme.family.regular },

  dotRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotMissed: { backgroundColor: 'rgba(22,24,29,0.10)' },
  dotFuture: { backgroundColor: 'transparent' },

  // Year view
  yearHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
    gap: 10,
  },
  yearHeading: {
    fontSize: theme.font.heading,
    color: theme.colors.text,
    fontFamily: theme.family.semibold,
  },
  yearTotalLabel: { fontSize: theme.font.small },

  tableShadow: { borderRadius: theme.radius },
  tableClip: {
    borderRadius: theme.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glass,
  },
  yearHeaderRow: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing(2),
  },
  nameCol: { width: 90, flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  yearHabitName: {
    flex: 1,
    fontSize: theme.font.small,
    color: theme.colors.text,
    fontFamily: theme.family.medium,
  },
  cell: {
    width: 36,
    textAlign: 'center',
    fontSize: theme.font.small,
    color: theme.colors.text,
    fontFamily: theme.family.regular,
  },
  cellHeader: { color: theme.colors.muted, fontFamily: theme.family.semibold },
  cellAccent: { color: theme.colors.accent, fontFamily: theme.family.bold },
  cellZero: { color: theme.colors.faint },
  cellSum: { color: theme.colors.muted, fontFamily: theme.family.semibold },
  cellSumActive: { color: theme.colors.text },

  foot: { marginTop: theme.spacing(4), textAlign: 'center', fontSize: theme.font.small },
});
