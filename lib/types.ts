export type Frequency = 'daily' | 'weekly';

export type HabitConditionType = 'screen_time_lt' | 'screen_time_gt';

export type HabitCondition = {
  type: HabitConditionType;
  value: number; // minutes
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  frequency: Frequency;
  archived: boolean;
  created_at: string;
  condition: HabitCondition | null;
};

export type HabitEntry = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
};

export type Todo = {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  notes: string | null;
  event_id: string | null;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  notes: string | null;
  source: string;
  created_at: string;
};

// Lokales Datum als YYYY-MM-DD (ohne Zeitzonenverschiebung)
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Montag der Woche, in der d liegt (als YYYY-MM-DD)
export function weekStartISO(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mo=0 … So=6
  date.setDate(date.getDate() - day);
  return todayISO(date);
}

// ── Datums-Helfer für den Kalender ───────────────────────────────────────────

// YYYY-MM-DD → Date (lokale Mitternacht, ohne Zeitzonen-Verschiebung)
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// n Tage zu einem ISO-Datum addieren (n darf negativ sein)
export function addDaysISO(iso: string, n: number): string {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + n);
  return todayISO(date);
}

// Erster und letzter Tag eines Monats als YYYY-MM-DD
export function monthRange(year: number, month: number): { firstISO: string; lastISO: string } {
  return {
    firstISO: todayISO(new Date(year, month, 1)),
    lastISO: todayISO(new Date(year, month + 1, 0)),
  };
}

// Wochen-Raster (Mo–So) für die Monatsansicht. Jede Woche hat 7 Einträge;
// Tage ausserhalb des Monats sind mit inMonth=false markiert.
export type CalendarCell = { iso: string; day: number; inMonth: boolean };

export function monthMatrix(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mo=0 … So=6
  const start = new Date(year, month, 1 - offset);

  const weeks: CalendarCell[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        iso: todayISO(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // Letzte Zeile weglassen, wenn sie komplett im Folgemonat liegt
    if (w >= 4 && cursor.getMonth() !== month) break;
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Lesbares Datum, z.B. "Fr, 3. Juli"
export function formatDayLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

// Lebendige, edle Farbpalette für Gewohnheiten (kein Violett)
export const HABIT_COLORS = [
  '#2563EB', // Blau
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#F43F5E', // Rose
];
