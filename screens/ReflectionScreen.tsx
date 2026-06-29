import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle } from '../components/ui';
import { Habit, todayISO } from '../lib/types';

export default function ReflectionScreen() {
  // offset 0 = aktueller Monat, -1 = letzter Monat …
  const [offset, setOffset] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const monthStart = todayISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = todayISO(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const load = useCallback(async () => {
    const [{ data: hs }, { data: entries }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_entries').select('habit_id').gte('date', monthStart).lte('date', monthEnd),
    ]);
    setHabits((hs as Habit[]) ?? []);
    const c: Record<string, number> = {};
    ((entries as { habit_id: string }[]) ?? []).forEach((e) => {
      c[e.habit_id] = (c[e.habit_id] ?? 0) + 1;
    });
    setCounts(c);
  }, [monthStart, monthEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const label = month.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
  const active = habits.filter((h) => (counts[h.id] ?? 0) > 0 || !h.archived);

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

      {active.length === 0 ? (
        <Muted>Noch keine Gewohnheiten getrackt.</Muted>
      ) : (
        <Card>
          {active.map((h, i) => {
            const n = counts[h.id] ?? 0;
            return (
              <View
                key={h.id}
                style={[styles.row, i < active.length - 1 && styles.rowDivider]}
              >
                <Text style={styles.name}>{h.name}</Text>
                <Text style={styles.score}>
                  {n}
                  <Text style={styles.outOf}> / {daysInMonth}</Text>
                </Text>
              </View>
            );
          })}
        </Card>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  name: { fontSize: theme.font.body, color: theme.colors.text, flex: 1 },
  score: { fontSize: 24, color: theme.colors.text, fontWeight: '600' },
  outOf: { fontSize: theme.font.body, color: theme.colors.faint, fontWeight: '400' },
  foot: { marginTop: theme.spacing(4), textAlign: 'center', fontSize: theme.font.small },
});
