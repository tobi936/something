import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { formatMinutes, useImportedScreenTime } from '../lib/useScreenTime';

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

// ── Shortcut setup card ─────────────────────────────────────────────────────
const DISMISSED_KEY = 'shortcut_guide_dismissed_v1';

const STEPS = [
  'Öffne die Kurzbefehle App auf deinem iPhone.',
  'Tippe auf „Automatisierung" → „+" → „Persönliche Automatisierung".',
  'Wähle „Tageszeit" (z.B. jeden Tag um 22:00 Uhr).',
  'Füge Aktion „Bildschirmzeit-Zusammenfassung abrufen" hinzu.',
  'Füge Aktion „URL-Inhalt abrufen" hinzu:\nURL: https://iohqjdtvivkfqarvhxll.supabase.co/functions/v1/screentime\nMethode: POST · JSON-Body: {\"minutes\": [Minuten aus Schritt 4]}\nHeader: Authorization = Bearer <TOKEN AUS DER APP-EINRICHTUNG>',
  'Deaktiviere „Vor Ausführung fragen" und speichere.',
];

function ShortcutSetupCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card style={styles.shortcutCard}>
      <View style={styles.shortcutHeader}>
        <Text style={styles.shortcutTitle}>iOS Bildschirmzeit einrichten</Text>
        <Pressable onPress={onDismiss} hitSlop={12}>
          <Text style={styles.shortcutClose}>✕</Text>
        </Pressable>
      </View>
      <Muted style={styles.shortcutDesc}>
        Importiere deine tägliche Bildschirmzeit automatisch via iOS Kurzbefehle.
      </Muted>
      {STEPS.map((step, i) => (
        <View key={i} style={styles.shortcutStep}>
          <View style={styles.shortcutBadge}>
            <Text style={styles.shortcutBadgeNum}>{i + 1}</Text>
          </View>
          <Text style={styles.shortcutStepText}>{step}</Text>
        </View>
      ))}
      <Pressable
        style={styles.shortcutBtn}
        onPress={() => Linking.openURL('shortcuts://')}
      >
        <Text style={styles.shortcutBtnText}>Kurzbefehle öffnen</Text>
      </Pressable>
      <Pressable onPress={onDismiss} style={{ marginTop: 10, alignItems: 'center' }}>
        <Muted style={{ fontSize: theme.font.small }}>Schliessen</Muted>
      </Pressable>
    </Card>
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
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const [newTodo, setNewTodo] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [shortcutDismissed, setShortcutDismissed] = useState(true); // default true until loaded
  const autoMarkedRef = useRef<Set<string>>(new Set());
  const importedScreenTime = useImportedScreenTime();

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => {
      setShortcutDismissed(v === '1');
    });
  }, []);

  function dismissShortcutCard() {
    setShortcutDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, '1');
  }

  const load = useCallback(async () => {
    autoMarkedRef.current = new Set();
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
    const loadedTodos = (t.data as Todo[]) ?? [];
    setHabits((h.data as Habit[]) ?? []);
    setWeekEntries((ent.data as HabitEntry[]) ?? []);
    setTodos(loadedTodos);
    setJustDone([]);
    setEvents((ev.data as CalendarEvent[]) ?? []);

    // Titel der verlinkten Termine nachladen (z.B. „Prüfung" für ein Lern-Todo)
    const linkedIds = [...new Set(loadedTodos.map((x) => x.event_id).filter(Boolean))] as string[];
    if (linkedIds.length > 0) {
      const { data: linked } = await supabase
        .from('calendar_events')
        .select('id, title')
        .in('id', linkedIds);
      const map: Record<string, string> = {};
      for (const e of (linked as { id: string; title: string }[]) ?? []) map[e.id] = e.title;
      setEventTitles(map);
    } else {
      setEventTitles({});
    }
  }, [today, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-mark conditional habits when screen time data is available
  useEffect(() => {
    if (importedScreenTime === null || habits.length === 0) return;

    const toMark: Habit[] = [];
    for (const h of habits) {
      if (!h.condition) continue;
      if (autoMarkedRef.current.has(h.id)) continue;

      const { type, value } = h.condition;
      const met =
        (type === 'screen_time_lt' && importedScreenTime < value) ||
        (type === 'screen_time_gt' && importedScreenTime > value);

      autoMarkedRef.current.add(h.id);
      if (!met) continue;

      const alreadyDone =
        h.frequency === 'weekly'
          ? weekEntries.some((e) => e.habit_id === h.id)
          : weekEntries.some((e) => e.habit_id === h.id && e.date === today);
      if (!alreadyDone) toMark.push(h);
    }

    if (toMark.length === 0) return;

    setWeekEntries((prev) => [
      ...prev,
      ...toMark.map((h) => ({
        id: `auto-${h.id}`,
        habit_id: h.id,
        user_id: userId,
        date: today,
        created_at: new Date().toISOString(),
      })),
    ]);
    toMark.forEach((h) =>
      supabase.from('habit_entries').insert({ habit_id: h.id, user_id: userId, date: today }),
    );
  }, [importedScreenTime, habits, weekEntries, today, userId]);

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

  function reopenTodo(todo: Todo) {
    setJustDone((prev) => prev.filter((t) => t.id !== todo.id));
    setTodos((prev) => [{ ...todo, done: false }, ...prev]);
    supabase.from('todos').update({ done: false }).eq('id', todo.id);
  }

  async function addTodo() {
    const trimmed = newTodo.trim();
    if (!trimmed) return;
    setNewTodo('');
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Todo = {
      id: tempId,
      user_id: userId,
      title: trimmed,
      done: false,
      due_date: null,
      notes: null,
      event_id: null,
      created_at: new Date().toISOString(),
    };
    setTodos((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from('todos')
      .insert({ user_id: userId, title: trimmed })
      .select()
      .single();
    if (data) {
      setTodos((prev) => prev.map((t) => (t.id === tempId ? (data as Todo) : t)));
    } else if (error) {
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
    }
  }

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
          {importedScreenTime !== null && (
            <View style={styles.timeBox}>
              <Text style={styles.screenTimeNum}>{formatMinutes(importedScreenTime)}</Text>
              <Muted style={styles.screenTimeSub}>Bildschirmzeit</Muted>
            </View>
          )}
        </View>

        {/* Ring */}
        <ProgressRing
          done={doneHabits.length}
          total={habits.length}
          pending={pendingHabits.map((h) => h.name)}
        />

        {/* Shortcut setup guide */}
        {importedScreenTime === null && !shortcutDismissed && (
          <ShortcutSetupCard onDismiss={dismissShortcutCard} />
        )}

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
                      {h.frequency === 'weekly' && !h.condition ? (
                        <Muted style={styles.tag}>diese Woche</Muted>
                      ) : null}
                      {h.condition ? (
                        <Muted style={styles.tag}>
                          auto · {h.condition.type === 'screen_time_lt' ? '<' : '>'}{Math.round(h.condition.value / 60)}h Bildschirm
                        </Muted>
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
                    {t.event_id && eventTitles[t.event_id] ? (
                      <Muted style={styles.tag}>→ {eventTitles[t.event_id]}</Muted>
                    ) : t.due_date ? (
                      <Muted style={styles.tag}>fällig {t.due_date}</Muted>
                    ) : null}
                  </View>
                  <Check on={false} />
                </Pressable>
              ))}
              {justDone.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => reopenTodo(t)}
                  style={[styles.row, i < justDone.length - 1 && styles.rowDivider]}
                >
                  <Text style={[styles.rowText, styles.rowTextDone]}>{t.title}</Text>
                  <Check on={true} />
                </Pressable>
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
                const time = ev.all_day
                  ? 'ganztägig'
                  : new Date(ev.start_time).toLocaleTimeString('de-CH', {
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

  shortcutCard: { marginBottom: theme.spacing(3) },
  shortcutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  shortcutTitle: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.semibold },
  shortcutClose: { fontSize: 16, color: theme.colors.faint, paddingLeft: 12 },
  shortcutDesc: { fontSize: theme.font.small, marginBottom: theme.spacing(2) },
  shortcutStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  shortcutBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  shortcutBadgeNum: { fontSize: 11, color: theme.colors.accent, fontFamily: theme.family.bold },
  shortcutStepText: { flex: 1, fontSize: theme.font.small, color: theme.colors.text, fontFamily: theme.family.regular, lineHeight: 18 },
  shortcutBtn: {
    marginTop: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shortcutBtnText: { fontSize: theme.font.body, color: '#fff', fontFamily: theme.family.semibold },
});
