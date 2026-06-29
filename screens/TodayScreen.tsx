import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Check, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { CalendarEvent, Habit, Todo, todayISO } from '../lib/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

function prettyDate(): string {
  return new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function TodayScreen({ userId }: { userId: string }) {
  const today = todayISO();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [doneHabitIds, setDoneHabitIds] = useState<Set<string>>(new Set());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [h, e, t, ev] = await Promise.all([
      supabase.from('habits').select('*').eq('archived', false).order('created_at'),
      supabase.from('habit_entries').select('habit_id').eq('date', today),
      supabase
        .from('todos')
        .select('*')
        .eq('done', false)
        .order('due_date', { nullsFirst: false }),
      supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time'),
    ]);
    setHabits((h.data as Habit[]) ?? []);
    setDoneHabitIds(new Set(((e.data as { habit_id: string }[]) ?? []).map((r) => r.habit_id)));
    setTodos((t.data as Todo[]) ?? []);
    setEvents((ev.data as CalendarEvent[]) ?? []);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleHabit(habit: Habit) {
    const isDone = doneHabitIds.has(habit.id);
    const next = new Set(doneHabitIds);
    if (isDone) {
      next.delete(habit.id);
      setDoneHabitIds(next);
      await supabase.from('habit_entries').delete().eq('habit_id', habit.id).eq('date', today);
    } else {
      next.add(habit.id);
      setDoneHabitIds(next);
      await supabase
        .from('habit_entries')
        .insert({ habit_id: habit.id, user_id: userId, date: today });
    }
  }

  async function toggleTodo(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    await supabase.from('todos').update({ done: true }).eq('id', todo.id);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
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
      <ScreenTitle subtitle={prettyDate()}>{greeting()}</ScreenTitle>

      <SectionLabel>Gewohnheiten</SectionLabel>
      {habits.length === 0 ? (
        <Muted style={styles.empty}>Noch keine Gewohnheiten. Leg im Tab „Gewohnheiten“ an.</Muted>
      ) : (
        <Card style={{ marginBottom: theme.spacing(3) }}>
          {habits.map((h, i) => {
            const on = doneHabitIds.has(h.id);
            return (
              <Pressable
                key={h.id}
                onPress={() => toggleHabit(h)}
                style={[styles.row, i < habits.length - 1 && styles.rowDivider]}
              >
                <Text style={[styles.rowText, on && styles.rowTextDone]}>{h.name}</Text>
                <Check on={on} />
              </Pressable>
            );
          })}
        </Card>
      )}

      <SectionLabel>Heute zu tun</SectionLabel>
      {todos.length === 0 ? (
        <Muted style={styles.empty}>Nichts offen. Ruhig.</Muted>
      ) : (
        <Card style={{ marginBottom: theme.spacing(3) }}>
          {todos.slice(0, 8).map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => toggleTodo(t)}
              style={[styles.row, i < Math.min(todos.length, 8) - 1 && styles.rowDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>{t.title}</Text>
                {t.due_date ? <Muted style={styles.due}>fällig {t.due_date}</Muted> : null}
              </View>
              <Check on={false} />
            </Pressable>
          ))}
        </Card>
      )}

      <SectionLabel>Termine heute</SectionLabel>
      {events.length === 0 ? (
        <Muted style={styles.empty}>Keine Termine.</Muted>
      ) : (
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
      )}

      <View style={{ height: theme.spacing(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { fontSize: theme.font.body, color: theme.colors.text },
  rowTextDone: { color: theme.colors.faint, textDecorationLine: 'line-through' },
  due: { fontSize: theme.font.small, marginTop: 2 },
  empty: { marginBottom: theme.spacing(3), fontSize: theme.font.body },
});
