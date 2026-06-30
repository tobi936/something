import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel, SoftButton } from '../components/ui';
import { Frequency, Habit, HabitCondition, HabitConditionType, HABIT_COLORS, todayISO } from '../lib/types';

export default function HabitsScreen({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<Frequency>('daily');
  const [adding, setAdding] = useState(false);
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [conditionType, setConditionType] = useState<HabitConditionType>('screen_time_lt');
  const [conditionHours, setConditionHours] = useState('2');
  const [nameError, setNameError] = useState(false);

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
    if (!trimmed) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setAdding(true);
    const color = HABIT_COLORS[habits.length % HABIT_COLORS.length];
    const condition: HabitCondition | null = conditionEnabled
      ? { type: conditionType, value: Math.round(parseFloat(conditionHours || '0') * 60) }
      : null;
    await supabase
      .from('habits')
      .insert({ user_id: userId, name: trimmed, frequency: freq, color, condition });
    setName('');
    setFreq('daily');
    setConditionEnabled(false);
    setConditionType('screen_time_lt');
    setConditionHours('2');
    setNameError(false);
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
          placeholderTextColor={nameError ? '#F43F5E' : theme.colors.faint}
          value={name}
          onChangeText={(t) => { setName(t); if (t.trim()) setNameError(false); }}
          onSubmitEditing={add}
          style={[styles.input, nameError && styles.inputError]}
        />
        {nameError && (
          <Text style={styles.errorText}>Bitte einen Titel eingeben.</Text>
        )}
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
        {/* Condition toggle */}
        <View style={styles.conditionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.conditionLabel}>Automatisch</Text>
            <Muted style={styles.conditionSub}>Wird erledigt wenn Bedingung erfüllt</Muted>
          </View>
          <Switch
            value={conditionEnabled}
            onValueChange={setConditionEnabled}
            trackColor={{ true: theme.colors.accent }}
            thumbColor="#fff"
          />
        </View>

        {conditionEnabled && (
          <View style={styles.conditionBox}>
            <Muted style={styles.conditionBoxLabel}>Wenn …</Muted>
            {/* Variable: only screen time for now */}
            <View style={styles.conditionPill}>
              <Text style={styles.conditionPillText}>Bildschirmzeit heute</Text>
            </View>
            {/* Operator */}
            <View style={styles.segment}>
              {(['screen_time_lt', 'screen_time_gt'] as HabitConditionType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setConditionType(t)}
                  style={[styles.segmentItem, conditionType === t && styles.segmentItemOn]}
                >
                  <Text style={[styles.segmentText, conditionType === t && styles.segmentTextOn]}>
                    {t === 'screen_time_lt' ? 'unter' : 'über'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Value */}
            <View style={styles.conditionValueRow}>
              <TextInput
                value={conditionHours}
                onChangeText={setConditionHours}
                keyboardType="decimal-pad"
                style={styles.conditionValueInput}
                selectTextOnFocus
              />
              <Text style={styles.conditionValueUnit}>Stunden</Text>
            </View>
            <Muted style={styles.conditionPreview}>
              → Erledigt wenn Bildschirmzeit {conditionType === 'screen_time_lt' ? 'unter' : 'über'}{' '}
              {conditionHours || '0'}h
            </Muted>
          </View>
        )}

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
                  {h.condition && (
                    <>
                      {' · '}
                      {h.condition.type === 'screen_time_lt' ? '<' : '>'}
                      {' '}{Math.round(h.condition.value / 60)}h Bildschirm
                    </>
                  )}
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
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244,63,94,0.05)',
  },
  errorText: {
    fontSize: theme.font.small,
    color: '#F43F5E',
    fontFamily: theme.family.regular,
    marginBottom: theme.spacing(1.5),
    marginLeft: 4,
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

  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
    marginBottom: 4,
  },
  conditionLabel: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.medium },
  conditionSub: { fontSize: theme.font.small - 1, marginTop: 1 },
  conditionBox: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    gap: 8,
  },
  conditionBoxLabel: { fontSize: theme.font.small, marginBottom: 2 },
  conditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  conditionPillText: { fontSize: theme.font.small, color: theme.colors.accent, fontFamily: theme.family.semibold },
  conditionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  conditionValueInput: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.medium,
    width: 70,
    textAlign: 'center',
  },
  conditionValueUnit: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.regular },
  conditionPreview: { fontSize: theme.font.small, fontStyle: 'italic' },
});
