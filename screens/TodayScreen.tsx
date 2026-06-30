import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Check, Muted, SectionLabel } from '../components/ui';
import { CalendarEvent, Habit, HabitEntry, Todo, todayISO, weekStartISO } from '../lib/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 78;
  const SW = 16;
  const circ = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  const dash = pct * circ;

  return (
    <View style={styles.ringWrap}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={R}
          stroke="rgba(22,24,29,0.07)"
          strokeWidth={SW}
          fill="none"
        />
        {/* Progress arc — rotated to start at 12 o'clock */}
        {dash > 0 && (
          <G transform={`rotate(-90, ${cx}, ${cy})`}>
            <Circle
              cx={cx}
              cy={cy}
              r={R}
              stroke={theme.colors.accent}
              strokeWidth={SW}
              fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
            />
          </G>
        )}
      </Svg>
      <Text style={styles.ringNum}>{total > 0 ? done : '—'}</Text>
      {total > 0 && <Text style={styles.ringDen}>/ {total}</Text>}
    </View>
  );
}

export default function TodayScreen({ userId }: { userId: string }) {
  const today = todayISO();
  const weekStart = weekStartISO();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekEntries, setWeekEntries] = useState<HabitEntry[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [justDone, setJustDone] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [h, ent, t, ev] = await Promise.all([
      supabase.from('habits').select('*').eq('archived', false).order('created_at'),
      supabase.from('habit_entries').select('*').gte('date', weekStart).lte('date', today),
      supabase.from('todos').select('*').eq('done', false).order('created_at'),
      supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time'),
    ]);
    setHabits((h.data as Habit[]) ?? []);
    setWeekEntries((ent.data as HabitEntry[]) ?? []);
    setTodos((t.data as Todo[]) ?? []);
    setJustDone([]);
    setEvents((ev.data as CalendarEvent[]) ?? []);
  }, [today, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  function isDone(h: Habit): boolean {
    if (h.frequency === 'weekly') return weekEntries.some((e) => e.habit_id === h.id);
    return weekEntries.some((e) => e.habit_id === h.id && e.date === today);
  }

  async function toggleHabit(habit: Habit) {
    const done = isDone(habit);
    if (done) {
      if (habit.frequency === 'weekly') {
        setWeekEntries((prev) => prev.filter((e) => e.habit_id !== habit.id));
        await supabase
          .from('habit_entries')
          .delete()
          .eq('habit_id', habit.id)
          .gte('date', weekStart)
          .lte('date', today);
      } else {
        setWeekEntries((prev) =>
          prev.filter((e) => !(e.habit_id === habit.id && e.date === today)),
        );
        await supabase
          .from('habit_entries')
          .delete()
          .eq('habit_id', habit.id)
          .eq('date', today);
      }
    } else {
      const optimistic: HabitEntry = {
        id: `tmp-${habit.id}`,
        habit_id: habit.id,
        user_id: userId,
        date: today,
        created_at: new Date().toISOString(),
      };
      setWeekEntries((prev) => [...prev, optimistic]);
      await supabase
        .from('habit_entries')
        .insert({ habit_id: habit.id, user_id: userId, date: today });
    }
  }

  function completeTodo(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    setJustDone((prev) => [{ ...todo, done: true }, ...prev]);
    supabase.from('todos').update({ done: true }).eq('id', todo.id);
  }

  async function addTodo() {
    const trimmed = newTodo.trim();
    if (!trimmed) return;
    setNewTodo('');
    const { data } = await supabase
      .from('todos')
      .insert({ user_id: userId, title: trimmed })
      .select()
      .single();
    if (data) setTodos((prev) => [...prev, data as Todo]);
  }

  const done = habits.filter((h) => isDone(h)).length;
  const dateStr = new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.colors.muted}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Muted style={styles.dateText}>{dateStr}</Muted>
        </View>

        {/* Ring */}
        <ProgressRing done={done} total={habits.length} />
        <Muted style={styles.ringLabel}>
          {habits.length === 0 ? 'Noch keine Gewohnheiten' : 'Gewohnheiten heute'}
        </Muted>

        {/* Habits */}
        {habits.length > 0 && (
          <>
            <SectionLabel>Gewohnheiten</SectionLabel>
            <Card style={{ marginBottom: theme.spacing(3) }}>
              {habits.map((h, i) => {
                const on = isDone(h);
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => toggleHabit(h)}
                    style={[styles.row, i < habits.length - 1 && styles.rowDivider]}
                  >
                    <View style={[styles.habitDot, { backgroundColor: h.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowText, on && styles.rowTextDone]}>{h.name}</Text>
                      {h.frequency === 'weekly' ? (
                        <Muted style={styles.tag}>diese Woche</Muted>
                      ) : null}
                    </View>
                    <Check on={on} color={h.color} />
                  </Pressable>
                );
              })}
            </Card>
          </>
        )}

        {/* Todos */}
        <SectionLabel>Todos</SectionLabel>
        <Card style={{ marginBottom: theme.spacing(3) }}>
          <View style={styles.addRow}>
            <TextInput
              placeholder="Neues Todo …"
              placeholderTextColor={theme.colors.faint}
              value={newTodo}
              onChangeText={setNewTodo}
              onSubmitEditing={addTodo}
              returnKeyType="done"
              style={styles.addInput}
            />
          </View>
          {todos.length === 0 && justDone.length === 0 ? (
            <Muted style={styles.empty}>Nichts offen.</Muted>
          ) : (
            <>
              {todos.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => completeTodo(t)}
                  style={[styles.row, styles.rowDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>{t.title}</Text>
                    {t.due_date ? (
                      <Muted style={styles.tag}>fällig {t.due_date}</Muted>
                    ) : null}
                  </View>
                  <Check on={false} />
                </Pressable>
              ))}
              {justDone.map((t, i) => (
                <View
                  key={t.id}
                  style={[styles.row, i < justDone.length - 1 && styles.rowDivider]}
                >
                  <Text style={[styles.rowText, styles.rowTextDone]}>{t.title}</Text>
                  <Check on={true} />
                </View>
              ))}
            </>
          )}
        </Card>

        {/* Calendar events (only if any) */}
        {events.length > 0 && (
          <>
            <SectionLabel>Termine</SectionLabel>
            <Card>
              {events.map((ev, i) => {
                const time = new Date(ev.start_time).toLocaleTimeString('de-CH', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View
                    key={ev.id}
                    style={[styles.row, i < events.length - 1 && styles.rowDivider]}
                  >
                    <Text style={styles.rowText}>{ev.title}</Text>
                    <Muted>{time}</Muted>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <View style={{ height: theme.spacing(6) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },

  header: { marginBottom: theme.spacing(3) },
  greeting: {
    fontSize: theme.font.title,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -0.5,
  },
  dateText: { marginTop: 4, fontSize: theme.font.body },

  ringWrap: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: {
    fontSize: 48,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -2,
    lineHeight: 52,
  },
  ringDen: {
    fontSize: theme.font.body,
    color: theme.colors.faint,
    fontFamily: theme.family.regular,
    marginTop: 2,
  },
  ringLabel: {
    textAlign: 'center',
    fontSize: theme.font.small,
    marginTop: 10,
    marginBottom: theme.spacing(3),
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  rowText: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.medium },
  rowTextDone: { color: theme.colors.faint, textDecorationLine: 'line-through' },
  tag: { fontSize: theme.font.small, marginTop: 2 },
  habitDot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing(1.5) },
  empty: { paddingVertical: 8, fontSize: theme.font.body },

  addRow: { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 12, marginBottom: 2 },
  addInput: {
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.regular,
    paddingVertical: 4,
  },
});
