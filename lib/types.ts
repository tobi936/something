export type Habit = {
  id: string;
  user_id: string;
  name: string;
  color: string;
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
