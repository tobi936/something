export type Frequency = 'daily' | 'weekly';

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  frequency: Frequency;
  archived: boolean;
  created_at: string;
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
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
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

// Sanfte Farbpalette für Gewohnheiten
export const HABIT_COLORS = [
  '#6B7B6E', // Salbei
  '#8C7B6B', // Sand
  '#6B7A8C', // Nebelblau
  '#8C6B7B', // Altrosa
  '#7B8C6B', // Olive
  '#7B6B8C', // Lavendel
];
