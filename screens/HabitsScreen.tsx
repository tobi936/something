import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel, SoftButton } from '../components/ui';
import { Frequency, Habit, HABIT_COLORS, todayISO } from '../lib/types';

export default function HabitsScreen({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<Frequency>('daily');
  const [adding, setAdding] = useState(false);

  const monthStart = todayISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const load = useCallback(async () => {
    const { data: hs } = await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
      .order('created_at');
    const list = (hs as Habit[]) ?? [];
    setHabits(list);

    const { data: entries } = await supabase
      .from('habit_entries')
      .select('habit_id')
      .gte('date', monthStart);
    const c: Record<string, number> = {};
    ((entries as { habit_id: string }[]) ?? []).forEach((e) => {
      c[e.habit_id] = (c[e.habit_id] ?? 0) + 1;
    });
    setCounts(c);
  }, [monthStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    const color = HABIT_COLORS[habits.length % HABIT_COLORS.length];
    await supabase
      .from('habits')
      .insert({ user_id: userId, name: trimmed, frequency: freq, color });
    setName('');
    setFreq('daily');
    setAdding(false);
    load();
  }

  async function archive(h: Habit) {
    await supabase.from('habits').update({ archived: true }).eq('id', h.id);
    load();
  }

  const monthName = new Date().toLocaleDateString('de-CH', { month: 'long' });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle subtitle="Was du tracken willst. Du bestimmst.">Gewohnheiten</ScreenTitle>

      <Card style={{ marginBottom: theme.spacing(3) }}>
        <TextInput
          placeholder="Neue Gewohnheit …"
          placeholderTextColor={theme.colors.faint}
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          style={styles.input}
        />
        <View style={styles.segment}>
          {(['daily', 'weekly'] as Frequency[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFreq(f)}
              style={[styles.segmentItem, freq === f && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentText, freq === f && styles.segmentTextOn]}>
                {f === 'daily' ? 'Täglich' : 'Wöchentlich'}
              </Text>
            </Pressable>
          ))}
        </View>
        <SoftButton label="Hinzufügen" onPress={add} loading={adding} />
      </Card>

      <SectionLabel>{`Diesen Monat · ${monthName}`}</SectionLabel>
      {habits.length === 0 ? (
        <Muted>Noch leer. Fang mit einer an — Sport, Lesen, jemandem schreiben.</Muted>
      ) : (
        <Card>
          {habits.map((h, i) => (
            <View
              key={h.id}
              style={[styles.row, i < habits.length - 1 && styles.rowDivider]}
            >
              <View style={[styles.dot, { backgroundColor: h.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{h.name}</Text>
                <Muted style={styles.meta}>
                  {h.frequency === 'daily' ? 'täglich' : 'wöchentlich'} · {counts[h.id] ?? 0}×
                </Muted>
              </View>
              <Pressable onPress={() => archive(h)} hitSlop={10}>
                <Text style={styles.remove}>archivieren</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <View style={{ height: theme.spacing(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 12,
    fontSize: theme.font.body,
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    marginBottom: theme.spacing(1.5),
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segmentItemOn: { backgroundColor: theme.colors.accentSoft },
  segmentText: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.medium },
  segmentTextOn: { color: theme.colors.text, fontFamily: theme.family.semibold },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing(1.5) },
  name: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.medium },
  meta: { fontSize: theme.font.small, marginTop: 2 },
  remove: { color: theme.colors.faint, fontSize: theme.font.small, fontFamily: theme.family.regular },
});
