-- Kalender ↔ Todos: Termine mit Todos verlinken + Event-Metadaten
-- Verlinkt Lern-Todos (z.B. Mo/Di/Mi) mit einem Termin (z.B. Prüfung am Freitag).

-- Todos können optional zu einem Termin gehören. Wird der Termin gelöscht,
-- bleiben die Todos erhalten (nur ohne Verknüpfung).
alter table public.todos
  add column if not exists event_id uuid references public.calendar_events(id) on delete set null;

create index if not exists idx_todos_event_id on public.todos(event_id);

-- Termine können ganztägig sein (Prüfung ohne Uhrzeit) und eine Notiz tragen.
alter table public.calendar_events
  add column if not exists all_day boolean not null default false;

alter table public.calendar_events
  add column if not exists notes text;

-- Beschleunigt die Monats-/Agenda-Abfragen pro Nutzer.
create index if not exists idx_calendar_events_user_start
  on public.calendar_events(user_id, start_time);
