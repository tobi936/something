import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Check, GradientBackground, Muted, SectionLabel, SoftButton } from '../components/ui';
import {
  CalendarEvent,
  Todo,
  WEEKDAY_LABELS,
  addDaysISO,
  formatDayLabel,
  monthMatrix,
  todayISO,
} from '../lib/types';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

// Lokales Datum eines Termins (rundet Zeitzone korrekt, da als echter Instant gespeichert)
function eventDateISO(ev: CalendarEvent): string {
  return todayISO(new Date(ev.start_time));
}

function eventTimeLabel(ev: CalendarEvent): string {
  if (ev.all_day) return 'ganztägig';
  return new Date(ev.start_time).toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CalendarScreen({ userId }: { userId: string }) {
  const today = todayISO();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [mode, setMode] = useState<'month' | 'agenda'>('month');
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);

  // Sichtbarer Datumsbereich: im Monatsmodus das ganze 6-Wochen-Raster,
  // in der Agenda die nächsten 60 Tage.
  const range = useMemo(() => {
    if (mode === 'agenda') {
      return { start: today, end: addDaysISO(today, 60) };
    }
    const first = weeks[0][0].iso;
    const lastWeek = weeks[weeks.length - 1];
    return { start: first, end: lastWeek[lastWeek.length - 1].iso };
  }, [mode, weeks, today]);

  const load = useCallback(async () => {
    const [ev, td] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', `${range.start}T00:00:00`)
        .lte('start_time', `${range.end}T23:59:59`)
        .order('start_time'),
      supabase
        .from('todos')
        .select('*')
        .gte('due_date', range.start)
        .lte('due_date', range.end)
        .order('created_at'),
    ]);
    setEvents((ev.data as CalendarEvent[]) ?? []);
    setTodos((td.data as Todo[]) ?? []);
  }, [range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Maps nach Tag ───────────────────────────────────────────────────────────
  const eventsByDay = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const ev of events) (m[eventDateISO(ev)] ??= []).push(ev);
    return m;
  }, [events]);

  const todosByDay = useMemo(() => {
    const m: Record<string, Todo[]> = {};
    for (const t of todos) if (t.due_date) (m[t.due_date] ??= []).push(t);
    return m;
  }, [todos]);

  // ── Mutationen ───────────────────────────────────────────────────────────────
  async function addEvent(dateISO: string, title: string, timeStr: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const [y, m, d] = dateISO.split('-').map(Number);
    let start: string;
    let allDay: boolean;
    if (/^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
      const [hh, mm] = timeStr.trim().split(':').map(Number);
      start = new Date(y, m - 1, d, hh, mm).toISOString();
      allDay = false;
    } else {
      start = new Date(y, m - 1, d, 12, 0, 0).toISOString();
      allDay = true;
    }
    const { data } = await supabase
      .from('calendar_events')
      .insert({ user_id: userId, title: trimmed, start_time: start, all_day: allDay, source: 'app' })
      .select()
      .single();
    if (data) setEvents((prev) => [...prev, data as CalendarEvent]);
  }

  async function addTodo(dateISO: string, title: string, eventId: string | null) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Todo = {
      id: tempId,
      user_id: userId,
      title: trimmed,
      done: false,
      due_date: dateISO,
      notes: null,
      event_id: eventId,
      created_at: new Date().toISOString(),
    };
    setTodos((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from('todos')
      .insert({ user_id: userId, title: trimmed, due_date: dateISO, event_id: eventId })
      .select()
      .single();
    if (data) setTodos((prev) => prev.map((t) => (t.id === tempId ? (data as Todo) : t)));
    else if (error) setTodos((prev) => prev.filter((t) => t.id !== tempId));
  }

  function toggleTodo(t: Todo) {
    const next = !t.done;
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    supabase.from('todos').update({ done: next }).eq('id', t.id);
  }

  function saveEventNotes(id: string, notes: string) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, notes } : e)));
    setOpenEvent((e) => (e && e.id === id ? { ...e, notes } : e));
    supabase.from('calendar_events').update({ notes: notes || null }).eq('id', id);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function goMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const linkedTodos = useMemo(
    () => (openEvent ? todos.filter((t) => t.event_id === openEvent.id) : []),
    [openEvent, todos],
  );

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
        {/* Kopf: Monat + Navigation */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <View style={styles.navRow}>
            <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const t = new Date();
                setYear(t.getFullYear());
                setMonth(t.getMonth());
                setSelected(todayISO());
              }}
              hitSlop={8}
              style={styles.todayBtn}
            >
              <Text style={styles.todayBtnText}>Heute</Text>
            </Pressable>
            <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Umschalter Monat | Agenda */}
        <View style={styles.toggle}>
          {(['month', 'agenda'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.togglePill, mode === m && styles.togglePillActive]}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'month' ? 'Monat' : 'Agenda'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'month' ? (
          <>
            <Card style={{ marginBottom: theme.spacing(3) }}>
              <View style={styles.weekHead}>
                {WEEKDAY_LABELS.map((w) => (
                  <Text key={w} style={styles.weekHeadText}>{w}</Text>
                ))}
              </View>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((cell) => {
                    const isToday = cell.iso === today;
                    const isSelected = cell.iso === selected;
                    const hasEvent = (eventsByDay[cell.iso]?.length ?? 0) > 0;
                    const hasTodo = (todosByDay[cell.iso]?.length ?? 0) > 0;
                    return (
                      <Pressable
                        key={cell.iso}
                        style={styles.cell}
                        onPress={() => setSelected(cell.iso)}
                      >
                        <View style={[styles.cellInner, isSelected && styles.cellSelected]}>
                          <Text
                            style={[
                              styles.cellNum,
                              !cell.inMonth && styles.cellNumOut,
                              isToday && styles.cellNumToday,
                              isSelected && styles.cellNumSelected,
                            ]}
                          >
                            {cell.day}
                          </Text>
                          <View style={styles.dots}>
                            {hasEvent && (
                              <View
                                style={[
                                  styles.dot,
                                  { backgroundColor: theme.colors.accent },
                                  isSelected && styles.dotOnSelected,
                                ]}
                              />
                            )}
                            {hasTodo && (
                              <View
                                style={[
                                  styles.dot,
                                  { backgroundColor: '#10B981' },
                                  isSelected && styles.dotOnSelected,
                                ]}
                              />
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Card>

            <DayDetail
              dateISO={selected}
              events={eventsByDay[selected] ?? []}
              todos={todosByDay[selected] ?? []}
              onOpenEvent={setOpenEvent}
              onToggleTodo={toggleTodo}
              onAddEvent={(title, time) => addEvent(selected, title, time)}
              onAddTodo={(title) => addTodo(selected, title, null)}
            />
          </>
        ) : (
          <AgendaList
            startISO={today}
            days={61}
            eventsByDay={eventsByDay}
            todosByDay={todosByDay}
            onOpenEvent={setOpenEvent}
            onToggleTodo={toggleTodo}
          />
        )}

        <View style={{ height: theme.spacing(6) }} />
      </ScrollView>

      {/* Termin-Detail */}
      <Modal
        visible={openEvent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenEvent(null)}
      >
        <GradientBackground>
          <SafeAreaView style={{ flex: 1 }}>
            {openEvent && (
              <EventDetail
                event={openEvent}
                linkedTodos={linkedTodos}
                onClose={() => setOpenEvent(null)}
                onToggleTodo={toggleTodo}
                onSaveNotes={(notes) => saveEventNotes(openEvent.id, notes)}
                onAddLinkedTodo={(dayISO, title) => addTodo(dayISO, title, openEvent.id)}
              />
            )}
          </SafeAreaView>
        </GradientBackground>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Tagesdetail (Monatsmodus) ──────────────────────────────────────────────────
function DayDetail({
  dateISO,
  events,
  todos,
  onOpenEvent,
  onToggleTodo,
  onAddEvent,
  onAddTodo,
}: {
  dateISO: string;
  events: CalendarEvent[];
  todos: Todo[];
  onOpenEvent: (ev: CalendarEvent) => void;
  onToggleTodo: (t: Todo) => void;
  onAddEvent: (title: string, time: string) => void;
  onAddTodo: (title: string) => void;
}) {
  const [evTitle, setEvTitle] = useState('');
  const [evTime, setEvTime] = useState('');
  const [tdTitle, setTdTitle] = useState('');

  return (
    <>
      <SectionLabel>{formatDayLabel(dateISO)}</SectionLabel>

      <Card style={{ marginBottom: theme.spacing(3) }}>
        <Text style={styles.subLabel}>Termine</Text>
        {events.length === 0 ? (
          <Muted style={styles.empty}>Keine Termine.</Muted>
        ) : (
          events.map((ev, i) => (
            <Pressable
              key={ev.id}
              onPress={() => onOpenEvent(ev)}
              style={[styles.row, i < events.length - 1 && styles.rowDivider]}
            >
              <Text style={styles.rowText}>{ev.title}</Text>
              <Muted style={styles.timeText}>{eventTimeLabel(ev)}</Muted>
            </Pressable>
          ))
        )}
        <View style={styles.addBlock}>
          <TextInput
            placeholder="Neuer Termin …"
            placeholderTextColor={theme.colors.faint}
            value={evTitle}
            onChangeText={setEvTitle}
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            placeholder="HH:MM"
            placeholderTextColor={theme.colors.faint}
            value={evTime}
            onChangeText={setEvTime}
            style={[styles.input, styles.timeInput]}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <SoftButton
          label="Termin hinzufügen"
          onPress={() => {
            onAddEvent(evTitle, evTime);
            setEvTitle('');
            setEvTime('');
          }}
        />
      </Card>

      <Card>
        <Text style={styles.subLabel}>Todos</Text>
        {todos.length === 0 ? (
          <Muted style={styles.empty}>Nichts geplant.</Muted>
        ) : (
          todos.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => onToggleTodo(t)}
              style={[styles.row, i < todos.length - 1 && styles.rowDivider]}
            >
              <Text style={[styles.rowText, t.done && styles.rowTextDone]}>{t.title}</Text>
              <Check on={t.done} />
            </Pressable>
          ))
        )}
        <View style={styles.addBlock}>
          <TextInput
            placeholder="Neues Todo …"
            placeholderTextColor={theme.colors.faint}
            value={tdTitle}
            onChangeText={setTdTitle}
            onSubmitEditing={() => {
              onAddTodo(tdTitle);
              setTdTitle('');
            }}
            returnKeyType="done"
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        <SoftButton
          label="Todo hinzufügen"
          variant="ghost"
          onPress={() => {
            onAddTodo(tdTitle);
            setTdTitle('');
          }}
        />
      </Card>
    </>
  );
}

// ── Agenda-Liste ───────────────────────────────────────────────────────────────
function AgendaList({
  startISO,
  days,
  eventsByDay,
  todosByDay,
  onOpenEvent,
  onToggleTodo,
}: {
  startISO: string;
  days: number;
  eventsByDay: Record<string, CalendarEvent[]>;
  todosByDay: Record<string, Todo[]>;
  onOpenEvent: (ev: CalendarEvent) => void;
  onToggleTodo: (t: Todo) => void;
}) {
  const dayList: string[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDaysISO(startISO, i);
    if ((eventsByDay[iso]?.length ?? 0) > 0 || (todosByDay[iso]?.length ?? 0) > 0) {
      dayList.push(iso);
    }
  }

  if (dayList.length === 0) {
    return <Muted style={{ marginTop: theme.spacing(2) }}>Nichts in den nächsten Wochen.</Muted>;
  }

  return (
    <>
      {dayList.map((iso) => {
        const evs = eventsByDay[iso] ?? [];
        const tds = todosByDay[iso] ?? [];
        return (
          <View key={iso} style={{ marginBottom: theme.spacing(2.5) }}>
            <SectionLabel>{formatDayLabel(iso)}</SectionLabel>
            <Card>
              {evs.map((ev, i) => (
                <Pressable
                  key={ev.id}
                  onPress={() => onOpenEvent(ev)}
                  style={[styles.row, (i < evs.length - 1 || tds.length > 0) && styles.rowDivider]}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
                    <Text style={styles.rowText}>{ev.title}</Text>
                  </View>
                  <Muted style={styles.timeText}>{eventTimeLabel(ev)}</Muted>
                </Pressable>
              ))}
              {tds.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => onToggleTodo(t)}
                  style={[styles.row, i < tds.length - 1 && styles.rowDivider]}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.rowText, t.done && styles.rowTextDone]}>{t.title}</Text>
                  </View>
                  <Check on={t.done} />
                </Pressable>
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
}

// ── Termin-Detail (Modal-Inhalt) ────────────────────────────────────────────────
function EventDetail({
  event,
  linkedTodos,
  onClose,
  onToggleTodo,
  onSaveNotes,
  onAddLinkedTodo,
}: {
  event: CalendarEvent;
  linkedTodos: Todo[];
  onClose: () => void;
  onToggleTodo: (t: Todo) => void;
  onSaveNotes: (notes: string) => void;
  onAddLinkedTodo: (dayISO: string, title: string) => void;
}) {
  const [notes, setNotes] = useState(event.notes ?? '');
  const [planTitle, setPlanTitle] = useState('');
  const eventISO = eventDateISO(event);
  const today = todayISO();
  const [planDay, setPlanDay] = useState(today <= eventISO ? today : eventISO);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tag-Chips: von heute bis zum Termin (max. 21 Tage), damit man Lerntage davor wählt
  const chips: string[] = [];
  {
    const startISO = today <= eventISO ? today : eventISO;
    let cur = startISO;
    for (let i = 0; i < 31 && cur <= eventISO; i++) {
      chips.push(cur);
      cur = addDaysISO(cur, 1);
    }
    if (chips.length === 0) chips.push(eventISO);
  }

  function handleNotes(text: string) {
    setNotes(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveNotes(text), 600);
  }

  // verlinkte Todos nach Tag gruppieren
  const grouped: Record<string, Todo[]> = {};
  for (const t of linkedTodos) (grouped[t.due_date ?? 'ohne'] ??= []).push(t);
  const groupKeys = Object.keys(grouped).sort();

  return (
    <>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle} numberOfLines={1}>{event.title}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.modalClose}>Fertig</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Muted style={{ marginBottom: theme.spacing(2) }}>
          {formatDayLabel(eventISO)} · {eventTimeLabel(event)}
        </Muted>

        <SectionLabel>Notiz</SectionLabel>
        <Card style={{ marginBottom: theme.spacing(3) }}>
          <TextInput
            placeholder="Notiz zum Termin …"
            placeholderTextColor={theme.colors.faint}
            value={notes}
            onChangeText={handleNotes}
            multiline
            style={styles.notesInput}
          />
        </Card>

        <SectionLabel>Vorbereitung einplanen</SectionLabel>
        <Card style={{ marginBottom: theme.spacing(3) }}>
          <Muted style={{ fontSize: theme.font.small, marginBottom: theme.spacing(1.5) }}>
            Lege Lern-Todos auf den Tagen vor dem Termin an.
          </Muted>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.spacing(1.5) }}>
            {chips.map((iso) => {
              const active = iso === planDay;
              const label = new Date(`${iso}T12:00:00`).toLocaleDateString('de-CH', {
                weekday: 'short',
                day: 'numeric',
              });
              return (
                <Pressable
                  key={iso}
                  onPress={() => setPlanDay(iso)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {iso === today ? 'Heute' : label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.addBlock}>
            <TextInput
              placeholder="z.B. Kapitel 3 lernen …"
              placeholderTextColor={theme.colors.faint}
              value={planTitle}
              onChangeText={setPlanTitle}
              onSubmitEditing={() => {
                onAddLinkedTodo(planDay, planTitle);
                setPlanTitle('');
              }}
              returnKeyType="done"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <SoftButton
            label="Lern-Todo hinzufügen"
            onPress={() => {
              onAddLinkedTodo(planDay, planTitle);
              setPlanTitle('');
            }}
          />
        </Card>

        <SectionLabel>Verlinkte Todos</SectionLabel>
        {groupKeys.length === 0 ? (
          <Muted style={styles.empty}>Noch nichts geplant.</Muted>
        ) : (
          groupKeys.map((key) => (
            <View key={key} style={{ marginBottom: theme.spacing(2) }}>
              <Text style={styles.subLabel}>
                {key === 'ohne' ? 'Ohne Datum' : formatDayLabel(key)}
              </Text>
              <Card>
                {grouped[key].map((t, i) => (
                  <Pressable
                    key={t.id}
                    onPress={() => onToggleTodo(t)}
                    style={[styles.row, i < grouped[key].length - 1 && styles.rowDivider]}
                  >
                    <Text style={[styles.rowText, t.done && styles.rowTextDone]}>{t.title}</Text>
                    <Check on={t.done} />
                  </Pressable>
                ))}
              </Card>
            </View>
          ))
        )}

        <View style={{ height: theme.spacing(6) }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  title: {
    fontSize: theme.font.title,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -0.5,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.glassStrong,
  },
  navArrow: { fontSize: 20, color: theme.colors.text, lineHeight: 22 },
  todayBtn: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  todayBtnText: { fontSize: theme.font.small, color: theme.colors.accent, fontFamily: theme.family.semibold },

  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.glassStrong,
    borderRadius: 12,
    padding: 3,
    marginBottom: theme.spacing(3),
    gap: 3,
  },
  togglePill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  togglePillActive: { backgroundColor: theme.colors.accent },
  toggleText: { fontSize: theme.font.small, color: theme.colors.muted, fontFamily: theme.family.semibold },
  toggleTextActive: { color: '#fff' },

  weekHead: { flexDirection: 'row', marginBottom: 6 },
  weekHeadText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.faint,
    fontFamily: theme.family.semibold,
  },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: theme.colors.accent },
  cellNum: { fontSize: 15, color: theme.colors.text, fontFamily: theme.family.medium },
  cellNumOut: { color: theme.colors.faint, opacity: 0.5 },
  cellNumToday: { color: theme.colors.accent, fontFamily: theme.family.bold },
  cellNumSelected: { color: '#fff', fontFamily: theme.family.bold },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotOnSelected: { backgroundColor: 'rgba(255,255,255,0.9)' },

  subLabel: {
    fontSize: theme.font.small,
    color: theme.colors.muted,
    fontFamily: theme.family.semibold,
    marginBottom: 6,
  },
  empty: { paddingVertical: 8, fontSize: theme.font.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.medium },
  rowTextDone: { color: theme.colors.faint, textDecorationLine: 'line-through' },
  timeText: { fontSize: theme.font.small },

  addBlock: { flexDirection: 'row', gap: 8, marginTop: theme.spacing(1.5), marginBottom: theme.spacing(1.5) },
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 12,
    fontSize: theme.font.body,
    fontFamily: theme.family.regular,
    color: theme.colors.text,
  },
  timeInput: { width: 84, textAlign: 'center' },

  notesInput: {
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.regular,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.glassStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: theme.font.small, color: theme.colors.text, fontFamily: theme.family.medium },
  chipTextActive: { color: '#fff', fontFamily: theme.family.semibold },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.glassBorder,
    gap: 16,
  },
  modalTitle: { flex: 1, fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.bold },
  modalClose: { fontSize: theme.font.body, color: theme.colors.accent, fontFamily: theme.family.medium },
});
