import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
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
import { formatMinutes, useImportedScreenTime } from '../lib/useScreenTime';

// ── In-app screen time ──────────────────────────────────────────────────────
const STORAGE_KEY = () => `screentime_${todayISO()}`;

async function loadSecondsToday(): Promise<number> {
  const v = await AsyncStorage.getItem(STORAGE_KEY());
  return v ? parseInt(v, 10) : 0;
}

async function saveSecondsToday(s: number) {
  await AsyncStorage.setItem(STORAGE_KEY(), String(s));
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Greeting ────────────────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

// ── Progress ring ───────────────────────────────────────────────────────────
function ProgressRing({
  done,
  total,
  pending,
}: {
  done: number;
  total: number;
  pending: string[];
}) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 78;
  const SW = 16;
  const circ = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  const dash = pct * circ;
  const allDone = total > 0 && done === total;

  return (
    <View style={styles.ringSection}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={cx}
            cy={cy}
            r={R}
            stroke="rgba(22,24,29,0.07)"
            strokeWidth={SW}
            fill="none"
          />
          {dash > 0 && (
            <G transform={`rotate(-90, ${cx}, ${cy})`}>
              <Circle
                cx={cx}
                cy={cy}
                r={R}
                stroke={allDone ? '#10B981' : theme.colors.accent}
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

      {/* Pending label or all-done */}
      {allDone ? (
        <Muted style={styles.ringLabel}>Alles erledigt heute</Muted>
      ) : pending.length > 0 ? (
        <Muted style={styles.ringLabel}>
          {pending.join(' · ')} ausstehend
        </Muted>
      ) : (
        <Muted style={styles.ringLabel}>
          {total === 0 ? 'Noch keine Gewohnheiten' : 'Gewohnheiten heute'}
        </Muted>
      )}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
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

  // Screen time tracking
  const [secondsToday, setSecondsToday] = useState(0);
  const sessionStart = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    loadSecondsToday().then((s) => {
      accumulatedRef.current = s;
      setSecondsToday(s);
    });

    sessionStart.current = Date.now();

    // Tick every 10s to update display
    const ticker = setInterval(() => {
      if (sessionStart.current != null) {
        const sessionSec = Math.floor((Date.now() - sessionStart.current) / 1000);
        setSecondsToday(accumulatedRef.current + sessionSec);
      }
    }, 10000);

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (sessionStart.current != null) {
          const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
          accumulatedRef.current += elapsed;
          saveSecondsToday(accumulatedRef.current);
          setSecondsToday(accumulatedRef.current);
          sessionStart.current = null;
        }
      } else if (next === 'active') {
        sessionStart.current = Date.now();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      clearInterval(ticker);
      sub.remove();
      // Save on unmount
      if (sessionStart.current != null) {
        const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
        accumulatedRef.current += elapsed;
        saveSecondsToday(accumulatedRef.current);
      }
    };
  }, []);

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

  const importedScreenTime = useImportedScreenTime();

  const doneHabits = habits.filter((h) => isDone(h));
  const pendingHabits = habits.filter((h) => !isDone(h));
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
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Muted style={styles.dateText}>{dateStr}</Muted>
          </View>
          <View style={styles.timeBox}>
            {importedScreenTime !== null ? (
              <>
                <Text style={styles.screenTimeNum}>{formatMinutes(importedScreenTime)}</Text>
                <Muted style={styles.screenTimeSub}>Bildschirmzeit</Muted>
              </>
            ) : (
              <>
                <Text style={styles.screenTimeNum}>{formatTime(secondsToday)}</Text>
                <Muted style={styles.screenTimeSub}>im App</Muted>
              </>
            )}
          </View>
        </View>

        {/* Ring */}
        <ProgressRing
          done={doneHabits.length}
          total={habits.length}
          pending={pendingHabits.map((h) => h.name)}
        />

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
              {todos.map((t) => (
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

        {/* Calendar events */}
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

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(3),
  },
  greeting: {
    fontSize: theme.font.title,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -0.5,
  },
  dateText: { marginTop: 4, fontSize: theme.font.body },
  timeBox: { alignItems: 'flex-end', marginTop: 6 },
  screenTimeNum: { fontSize: 16, color: theme.colors.text, fontFamily: theme.family.semibold },
  screenTimeSub: { fontSize: 10, marginTop: 1 },

  ringSection: { alignItems: 'center', marginBottom: theme.spacing(3) },
  ringWrap: {
    width: 200,
    height: 200,
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

  addRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
    marginBottom: 2,
  },
  addInput: {
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.regular,
    paddingVertical: 4,
  },
});
