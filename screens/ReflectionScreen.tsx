import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { Habit, todayISO, weekStartISO } from '../lib/types';

type Entry = { habit_id: string; date: string };
type Mode = 'month' | 'year';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// SVG line chart: one line per series
function LineChart({
  series,
  width,
  currentMonthIdx,
}: {
  series: { color: string; data: number[] }[];
  width: number;
  currentMonthIdx: number;
}) {
  const H = 120;
  const padX = 6;
  const padY = 10;
  const plotW = width - padX * 2;
  const plotH = H - padY * 2;
  const allVals = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allVals, 1);

  const cx = (i: number) => padX + (i / 11) * plotW;
  const cy = (v: number) => padY + (1 - v / maxVal) * plotH;

  const currentX = cx(currentMonthIdx);

  return (
    <Svg width={width} height={H}>
      {/* current month marker */}
      <Line
        x1={currentX}
        y1={padY}
        x2={currentX}
        y2={padY + plotH}
        stroke="rgba(37,99,235,0.15)"
        strokeWidth={1.5}
      />
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => ({ x: cx(i), y: cy(v) }));
        let d = '';
        pts.forEach((p, i) => {
          if (i === 0) {
            d += `M ${p.x} ${p.y}`;
          } else {
            // smooth cubic bezier
            const prev = pts[i - 1];
            const cpx = (prev.x + p.x) / 2;
            d += ` C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
          }
        });
        return (
          <React.Fragment key={si}>
            <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" />
            {pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} />
            ))}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function ReflectionScreen() {
  const [mode, setMode] = useState<Mode>('month');
  const [offset, setOffset] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prevEntries, setPrevEntries] = useState<Entry[]>([]);

  const { width: screenWidth } = useWindowDimensions();
  // card inner: screenWidth - 2*24 (screen padding) - 2*16 (card inner padding)
  const chartWidth = screenWidth - 80;

  const now = new Date();
  const currentYear = now.getFullYear();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const monthStart = todayISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = todayISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayStr = todayISO();

  const prevMonthDate = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const prevMonthStart = todayISO(new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1));
  const prevMonthEnd = todayISO(new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0));

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

    if (mode === 'year') {
      const [{ data: hs }, { data: ent }] = await Promise.all([
        supabase.from('habits').select('*').order('created_at'),
        supabase.from('habit_entries').select('habit_id, date').gte('date', start).lte('date', end),
      ]);
      setHabits((hs as Habit[]) ?? []);
      setEntries((ent as Entry[]) ?? []);
      setPrevEntries([]);
    } else {
      const [{ data: hs }, { data: ent }, { data: prev }] = await Promise.all([
        supabase.from('habits').select('*').order('created_at'),
        supabase.from('habit_entries').select('habit_id, date').gte('date', start).lte('date', end),
        supabase
          .from('habit_entries')
          .select('habit_id, date')
          .gte('date', prevMonthStart)
          .lte('date', prevMonthEnd),
      ]);
      setHabits((hs as Habit[]) ?? []);
      setEntries((ent as Entry[]) ?? []);
      setPrevEntries((prev as Entry[]) ?? []);
    }
  }, [mode, monthStart, monthEnd, prevMonthStart, prevMonthEnd, currentYear]);

  useEffect(() => {
    load();
  }, [load]);

  const monthStats = useMemo(
    () =>
      habits.map((h) => {
        const mine = entries.filter((e) => e.habit_id === h.id);
        const prevMine = prevEntries.filter((e) => e.habit_id === h.id);
        const dates = new Set(mine.map((e) => e.date));

        let count: number, total: number, prevCount: number;
        if (h.frequency === 'weekly') {
          const weeks = new Set(mine.map((e) => weekStartISO(new Date(e.date))));
          const prevWeeks = new Set(prevMine.map((e) => weekStartISO(new Date(e.date))));
          count = weeks.size;
          total = weeksInMonth;
          prevCount = prevWeeks.size;
        } else {
          count = mine.length;
          total = daysInMonth;
          prevCount = prevMine.length;
        }

        return { habit: h, count, total, prevCount, dates, delta: count - prevCount };
      }),
    [habits, entries, prevEntries, daysInMonth, weeksInMonth],
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

  const totalDelta = shownMonth.reduce((sum, s) => sum + s.delta, 0);
  const prevMonthName = prevMonthDate.toLocaleDateString('de-CH', { month: 'short' });

  const lineSeries = shownYear.map((s) => ({ color: s.habit.color, data: s.monthly }));

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
            <View style={styles.totalRow}>
              <Text style={styles.totalNum}>{entries.length}</Text>
              {totalDelta !== 0 && (
                <Text style={styles.totalDelta}>
                  {totalDelta > 0 ? `+${totalDelta}` : `${totalDelta}`} vs {prevMonthName}
                </Text>
              )}
            </View>
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
                    return {
                      day,
                      dateStr,
                      future: offset === 0 && dateStr > todayStr,
                      checked: s.dates.has(dateStr),
                    };
                  });

                  const pct = s.total > 0 ? Math.round((s.count / s.total) * 100) : 0;
                  const deltaStr =
                    s.delta > 0 ? `↑ +${s.delta}` : s.delta < 0 ? `↓ ${s.delta}` : '→';

                  return (
                    <View
                      key={s.habit.id}
                      style={[styles.habitBlock, i < shownMonth.length - 1 && styles.divider]}
                    >
                      <View style={styles.habitHeader}>
                        <View style={[styles.colorDot, { backgroundColor: s.habit.color }]} />
                        <Text style={styles.habitName}>{s.habit.name}</Text>
                        <Text style={styles.pct}>{pct}%</Text>
                        <Text style={styles.scoreNum}>
                          {s.count}
                          <Text style={styles.outOf}> / {s.total}</Text>
                        </Text>
                        <Text style={styles.delta}>{deltaStr}</Text>
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
            <>
              {/* Line chart */}
              <SectionLabel>Verlauf</SectionLabel>
              <Card style={{ marginBottom: theme.spacing(3) }}>
                <LineChart
                  series={lineSeries}
                  width={chartWidth}
                  currentMonthIdx={now.getMonth()}
                />
                <View style={styles.chartXLabels}>
                  {MONTHS_DE.map((m, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.chartXLabel,
                        idx === now.getMonth() && styles.chartXLabelCurrent,
                      ]}
                    >
                      {m}
                    </Text>
                  ))}
                </View>
                <View style={styles.legend}>
                  {shownYear.map((s) => (
                    <View key={s.habit.id} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.habit.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {s.habit.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Data grid */}
              <SectionLabel>Tabelle</SectionLabel>
              <View style={[theme.shadow, styles.tableShadow]}>
                <View style={styles.tableClip}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
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
                          <Text
                            style={[
                              styles.cell,
                              styles.cellSum,
                              s.yearTotal > 0 && styles.cellSumActive,
                            ]}
                          >
                            {s.yearTotal}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </>
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
  toggleText: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.medium },
  toggleTextOn: { color: theme.colors.text, fontFamily: theme.family.semibold },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  arrow: { fontSize: 30, color: theme.colors.text, paddingHorizontal: theme.spacing(2) },
  arrowOff: { color: theme.colors.faint },
  monthHeading: { fontSize: theme.font.heading, color: theme.colors.text, fontFamily: theme.family.semibold },

  totalBox: { alignItems: 'center', marginBottom: theme.spacing(3) },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  totalNum: {
    fontSize: 56,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -2,
    lineHeight: 60,
  },
  totalDelta: {
    fontSize: theme.font.small,
    color: theme.colors.muted,
    fontFamily: theme.family.medium,
  },
  totalSub: { fontSize: theme.font.small, marginTop: 2 },

  habitBlock: { paddingVertical: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  habitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  habitName: { flex: 1, fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.medium },
  pct: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.medium },
  scoreNum: { fontSize: 18, color: theme.colors.text, fontFamily: theme.family.bold },
  outOf: { fontSize: theme.font.small, color: theme.colors.faint, fontFamily: theme.family.regular },
  delta: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.medium, minWidth: 36, textAlign: 'right' },

  dotRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotMissed: { backgroundColor: 'rgba(22,24,29,0.10)' },
  dotFuture: { backgroundColor: 'transparent' },

  // Year
  yearHeadRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: theme.spacing(2), gap: 10 },
  yearHeading: { fontSize: theme.font.heading, color: theme.colors.text, fontFamily: theme.family.semibold },
  yearTotalLabel: { fontSize: theme.font.small },

  // Chart
  chartXLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chartXLabel: { fontSize: 10, color: theme.colors.faint, fontFamily: theme.family.regular, flex: 1, textAlign: 'center' },
  chartXLabelCurrent: { color: theme.colors.accent, fontFamily: theme.family.semibold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing(1.5), gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.regular },

  // Table
  tableShadow: { borderRadius: theme.radius },
  tableClip: {
    borderRadius: theme.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glass,
  },
  yearHeaderRow: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  yearRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: theme.spacing(2) },
  nameCol: { width: 90, flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  yearHabitName: { flex: 1, fontSize: theme.font.small, color: theme.colors.text, fontFamily: theme.family.medium },
  cell: { width: 36, textAlign: 'center', fontSize: theme.font.small, color: theme.colors.text, fontFamily: theme.family.regular },
  cellHeader: { color: theme.colors.muted, fontFamily: theme.family.semibold },
  cellAccent: { color: theme.colors.accent, fontFamily: theme.family.bold },
  cellZero: { color: theme.colors.faint },
  cellSum: { color: theme.colors.muted, fontFamily: theme.family.semibold },
  cellSumActive: { color: theme.colors.text },

  foot: { marginTop: theme.spacing(4), textAlign: 'center', fontSize: theme.font.small },
});
