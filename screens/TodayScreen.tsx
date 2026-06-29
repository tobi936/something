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
import {
  CalendarEvent,
  Habit,
  HabitEntry,
  Todo,
  todayISO,
  weekStartISO,
} from '../lib/types';

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
  const weekStart = weekStartISO();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekEntries, setWeekEntries] = useState<HabitEntry[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [justDone, setJustDone] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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

  // Eine Gewohnheit gilt als erledigt: täglich = heutiger Eintrag, wöchentlich = irgendein Eintrag diese Woche.
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
            const on = isDone(h);
            return (
              <Pressable
                key={h.id}
                onPress={() => toggleHabit(h)}
                style={[styles.row, i < habits.length - 1 && styles.rowDivider]}
              >
                <View style={[styles.dot, { backgroundColor: h.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, on && styles.rowTextDone]}>{h.name}</Text>
                  {h.frequency === 'weekly' ? (
                    <Muted style={styles.tag}>diese Woche</Muted>
                  ) : null}
                </View>
                <Check on={on} />
              </Pressable>
            );
          })}
        </Card>
      )}

      <SectionLabel>Heute zu tun</SectionLabel>
      {todos.length === 0 && justDone.length === 0 ? (
        <Muted style={styles.empty}>Nichts offen. Ruhig.</Muted>
      ) : (
        <Card style={{ marginBottom: theme.spacing(3) }}>
          {todos.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => completeTodo(t)}
              style={[styles.row, (i < todos.length - 1 || justDone.length > 0) && styles.rowDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>{t.title}</Text>
                {t.due_date ? <Muted style={styles.tag}>fällig {t.due_date}</Muted> : null}
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
  tag: { fontSize: theme.font.small, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing(1.5) },
  empty: { marginBottom: theme.spacing(3), fontSize: theme.font.body },
});
