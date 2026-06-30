import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { Habit, todayISO, weekStartISO } from '../lib/types';

type Entry = { habit_id: string; date: string };
type Mode = 'month' | 'year';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Smooth multi-line SVG chart
function LineChart({
  series,
  width,
  height = 130,
  markerIdx,
  xLabels,
}: {
  series: { color: string; data: number[] }[];
  width: number;
  height?: number;
  markerIdx?: number;
  xLabels?: string[];
}) {
  const padX = 6;
  const padY = 10;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const n = series[0]?.data.length ?? 1;
  const allVals = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allVals, 1);

  const cx = (i: number) => padX + (i / Math.max(n - 1, 1)) * plotW;
  const cy = (v: number) => padY + (1 - v / maxVal) * plotH;

  const markerX = markerIdx != null ? cx(markerIdx) : null;

  return (
    <Svg width={width} height={height}>
      {markerX != null && (
        <Line
          x1={markerX}
          y1={padY}
          x2={markerX}
          y2={padY + plotH}
          stroke="rgba(37,99,235,0.15)"
          strokeWidth={1.5}
        />
      )}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => ({ x: cx(i), y: cy(v) }));
        let d = '';
        pts.forEach((p, i) => {
          if (i === 0) {
            d += `M ${p.x} ${p.y}`;
          } else {
            const prev = pts[i - 1];
            const cpx = (prev.x + p.x) / 2;
            d += ` C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
          }
        });
        return (
          <React.Fragment key={si}>
            <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" />
            {/* only show end-point dot */}
            {pts.length > 0 && (
              <Circle
                cx={pts[pts.length - 1].x}
                cy={pts[pts.length - 1].y}
                r={3.5}
                fill={s.color}
              />
            )}
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
    if (mode === 'year') {
      const [{ data: hs }, { data: ent }] = await Promise.all([
        supabase.from('habits').select('*').order('created_at'),
        supabase
          .from('habit_entries')
          .select('habit_id, date')
          .gte('date', `${currentYear}-01-01`)
          .lte('date', `${currentYear}-12-31`),
      ]);
      setHabits((hs as Habit[]) ?? []);
      setEntries((ent as Entry[]) ?? []);
      setPrevEntries([]);
    } else {
      const [{ data: hs }, { data: ent }, { data: prev }] = await Promise.all([
        supabase.from('habits').select('*').order('created_at'),
        supabase
          .from('habit_entries')
          .select('habit_id, date')
          .gte('date', monthStart)
          .lte('date', monthEnd),
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

  // How far into the current month are we (for clipping future days)
  const lastPlottedDay = offset === 0 ? parseInt(todayStr.slice(8), 10) : daysInMonth;

  // Cumulative per-habit lines for month view
  const monthSeries = useMemo(() => {
    return habits
      .filter((h) => !h.archived)
      .map((h) => {
        const datesSet = new Set(
          entries.filter((e) => e.habit_id === h.id).map((e) => e.date),
        );
        let cumul = 0;
        const data: number[] = [];
        for (let d = 1; d <= lastPlottedDay; d++) {
          const dateStr = `${monthStart.slice(0, 7)}-${String(d).padStart(2, '0')}`;
          if (datesSet.has(dateStr)) cumul++;
          data.push(cumul);
        }
        // trend vs prev month
        const prevMine = prevEntries.filter((e) => e.habit_id === h.id);
        let prevCount: number;
        if (h.frequency === 'weekly') {
          prevCount = new Set(prevMine.map((e) => weekStartISO(new Date(e.date)))).size;
        } else {
          prevCount = prevMine.length;
        }
        const delta = cumul - prevCount;
        return { habit: h, data, finalCount: cumul, delta };
      })
      .filter((s) => s.finalCount > 0 || entries.some((e) => e.habit_id === s.habit.id));
  }, [habits, entries, prevEntries, lastPlottedDay, monthStart]);

  // Monthly counts per habit for year view
  const yearSeries = useMemo(() => {
    return habits
      .filter((h) => !h.archived)
      .map((h) => {
        const mine = entries.filter((e) => e.habit_id === h.id);
        const monthly = Array(12).fill(0) as number[];
        mine.forEach((e) => {
          monthly[parseInt(e.date.slice(5, 7), 10) - 1]++;
        });
        return { habit: h, data: monthly, yearTotal: mine.length };
      })
      .filter((s) => s.yearTotal > 0);
  }, [habits, entries]);

  const totalCheckins = entries.length;
  const monthLabel = month.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
  const prevMonthName = prevMonthDate.toLocaleDateString('de-CH', { month: 'short' });
  const totalDelta = monthSeries.reduce((s, x) => s + x.delta, 0);

  // x-axis labels for month chart: first day and last plotted day
  const monthXLabels = Array.from({ length: lastPlottedDay }, (_, i) => String(i + 1));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle subtitle="Schau zurück. Die Zahlen sind deine.">Rückblick</ScreenTitle>

      {/* Mode toggle */}
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
          {/* Month nav */}
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

          {/* Total */}
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalNum}>{totalCheckins}</Text>
              {totalDelta !== 0 && (
                <Text style={styles.totalDelta}>
                  {totalDelta > 0 ? `+${totalDelta}` : `${totalDelta}`} vs {prevMonthName}
                </Text>
              )}
            </View>
            <Muted style={styles.totalSub}>Einträge</Muted>
          </View>

          {monthSeries.length === 0 ? (
            <Muted>Noch keine Gewohnheiten getrackt.</Muted>
          ) : (
            <>
              {/* Cumulative line chart */}
              <Card style={{ marginBottom: theme.spacing(3) }}>
                <LineChart
                  series={monthSeries.map((s) => ({ color: s.habit.color, data: s.data }))}
                  width={chartWidth}
                  height={140}
                />
                {/* X axis: first and last day */}
                <View style={styles.monthXRow}>
                  <Text style={styles.xLabel}>1</Text>
                  <Text style={styles.xLabel}>{lastPlottedDay}</Text>
                </View>

                {/* Compact legend with final count */}
                <View style={styles.legend}>
                  {monthSeries.map((s) => (
                    <View key={s.habit.id} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.habit.color }]} />
                      <Text style={styles.legendName}>{s.habit.name}</Text>
                      <Text style={styles.legendCount}>{s.finalCount}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          {/* Year view */}
          <View style={styles.yearHeadRow}>
            <Text style={styles.yearHeading}>{currentYear}</Text>
            <Muted style={styles.yearTotalLabel}>{totalCheckins} Einträge</Muted>
          </View>

          {yearSeries.length === 0 ? (
            <Muted>Noch keine Gewohnheiten getrackt.</Muted>
          ) : (
            <Card>
              <LineChart
                series={yearSeries.map((s) => ({ color: s.habit.color, data: s.data }))}
                width={chartWidth}
                height={180}
                markerIdx={now.getMonth()}
              />
              {/* Month x-axis */}
              <View style={styles.yearXRow}>
                {MONTHS_DE.map((m, idx) => (
                  <Text
                    key={idx}
                    style={[styles.xLabel, idx === now.getMonth() && styles.xLabelCurrent]}
                  >
                    {m}
                  </Text>
                ))}
              </View>
              {/* Legend with year totals */}
              <View style={styles.legend}>
                {yearSeries.map((s) => (
                  <View key={s.habit.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: s.habit.color }]} />
                    <Text style={styles.legendName}>{s.habit.name}</Text>
                    <Text style={styles.legendCount}>{s.yearTotal}</Text>
                  </View>
                ))}
              </View>
            </Card>
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
  totalNum: { fontSize: 56, color: theme.colors.text, fontFamily: theme.family.bold, letterSpacing: -2, lineHeight: 60 },
  totalDelta: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.medium },
  totalSub: { fontSize: theme.font.small, marginTop: 2 },

  // x-axis rows
  monthXRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  yearXRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { fontSize: 10, color: theme.colors.faint, fontFamily: theme.family.regular },
  xLabelCurrent: { color: theme.colors.accent, fontFamily: theme.family.semibold },

  // legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing(2), gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.regular },
  legendCount: { fontSize: theme.font.small, color: theme.colors.text, fontFamily: theme.family.semibold },

  yearHeadRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: theme.spacing(2), gap: 10 },
  yearHeading: { fontSize: theme.font.heading, color: theme.colors.text, fontFamily: theme.family.semibold },
  yearTotalLabel: { fontSize: theme.font.small },

  foot: { marginTop: theme.spacing(4), textAlign: 'center', fontSize: theme.font.small },
});
