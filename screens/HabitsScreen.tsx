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
import { Habit, todayISO } from '../lib/types';

export default function HabitsScreen({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
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
    await supabase.from('habits').insert({ user_id: userId, name: trimmed });
    setName('');
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
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{h.name}</Text>
                <Muted style={styles.count}>{counts[h.id] ?? 0} Tage</Muted>
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
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },
  input: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 12,
    fontSize: theme.font.body,
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  name: { fontSize: theme.font.body, color: theme.colors.text },
  count: { fontSize: theme.font.small, marginTop: 2 },
  remove: { color: theme.colors.faint, fontSize: theme.font.small },
});
