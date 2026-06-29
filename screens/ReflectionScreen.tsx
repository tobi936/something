import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { Habit, todayISO, weekStartISO } from '../lib/types';

type Entry = { habit_id: string; date: string };

export default function ReflectionScreen() {
  // offset 0 = aktueller Monat, -1 = letzter Monat …
  const [offset, setOffset] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const monthStart = todayISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = todayISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  // Anzahl Wochen, die diesen Monat berühren
  const weeksInMonth = useMemo(() => {
    const set = new Set<string>();
    for (let d = 1; d <= daysInMonth; d++) {
      set.add(weekStartISO(new Date(month.getFullYear(), month.getMonth(), d)));
    }
    return set.size;
  }, [daysInMonth, month]);

  const load = useCallback(async () => {
    const [{ data: hs }, { data: ent }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase
        .from('habit_entries')
        .select('habit_id, date')
        .gte('date', monthStart)
        .lte('date', monthEnd),
    ]);
    setHabits((hs as Habit[]) ?? []);
    setEntries((ent as Entry[]) ?? []);
  }, [monthStart, monthEnd]);

  useEffect(() => {
    load();
  }, [load]);

  // Score pro Gewohnheit: täglich = Tage, wöchentlich = Wochen mit Eintrag
  const stats = useMemo(() => {
    return habits.map((h) => {
      const mine = entries.filter((e) => e.habit_id === h.id);
      if (h.frequency === 'weekly') {
        const weeks = new Set(mine.map((e) => weekStartISO(new Date(e.date))));
        return { habit: h, count: weeks.size, total: weeksInMonth };
      }
      return { habit: h, count: mine.length, total: daysInMonth };
    });
  }, [habits, entries, daysInMonth, weeksInMonth]);

  const shown = stats.filter((s) => s.count > 0 || !s.habit.archived);
  const totalCheckins = entries.length;
  const best = shown.reduce<typeof shown[number] | null>(
    (b, s) => (b === null || s.count / s.total > b.count / b.total ? s : b),
    null,
  );

  const label = month.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle subtitle="Schau zurück. Die Zahlen sind deine.">Rückblick</ScreenTitle>

      <View style={styles.nav}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{label}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.min(o + 1, 0))}
          hitSlop={12}
          disabled={offset >= 0}
        >
          <Text style={[styles.arrow, offset >= 0 && styles.arrowOff]}>›</Text>
        </Pressable>
      </View>

      {shown.length === 0 ? (
        <Muted>Noch keine Gewohnheiten getrackt.</Muted>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalCheckins}</Text>
              <Muted style={styles.summaryLabel}>Einträge</Muted>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{shown.length}</Text>
              <Muted style={styles.summaryLabel}>Gewohnheiten</Muted>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum} numberOfLines={1}>
                {best && best.count > 0 ? best.habit.name : '—'}
              </Text>
              <Muted style={styles.summaryLabel}>am stärksten</Muted>
            </View>
          </View>

          <SectionLabel>Score</SectionLabel>
          <Card>
            {shown.map((s, i) => {
              const pct = s.total > 0 ? Math.round((s.count / s.total) * 100) : 0;
              return (
                <View
                  key={s.habit.id}
                  style={[styles.row, i < shown.length - 1 && styles.rowDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.habit.name}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: s.habit.color },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.score}>
                    {s.count}
                    <Text style={styles.outOf}> / {s.total}</Text>
                  </Text>
                </View>
              );
            })}
          </Card>
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
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  arrow: { fontSize: 30, color: theme.colors.text, paddingHorizontal: theme.spacing(2) },
  arrowOff: { color: theme.colors.faint },
  month: { fontSize: theme.font.heading, color: theme.colors.text, fontWeight: '500' },
  summary: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  summaryNum: { fontSize: 22, color: theme.colors.text, fontWeight: '600' },
  summaryLabel: { fontSize: theme.font.small, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  name: { fontSize: theme.font.body, color: theme.colors.text, marginBottom: 8 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    marginRight: theme.spacing(2),
  },
  barFill: { height: 6, borderRadius: 3 },
  score: { fontSize: 22, color: theme.colors.text, fontWeight: '600' },
  outOf: { fontSize: theme.font.body, color: theme.colors.faint, fontWeight: '400' },
  foot: { marginTop: theme.spacing(4), textAlign: 'center', fontSize: theme.font.small },
});
