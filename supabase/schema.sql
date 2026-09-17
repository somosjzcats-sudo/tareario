-- Esquema para "Casa Tareas" en Supabase.
-- Pégalo en el SQL Editor de tu proyecto Supabase (Project > SQL Editor > New query) y ejecútalo.

create table if not exists tasks (
  id text primary key,
  room text not null,
  title text not null,
  detail text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_months int not null default 1,
  times_per_period int not null default 1,
  minutes int not null default 5,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists occurrences (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  date date not null,
  assigned_to text not null check (assigned_to in ('zaira', 'jef')),
  status text not null default 'pending' check (status in ('pending', 'done', 'missed')),
  completed_by text check (completed_by in ('zaira', 'jef')),
  completed_at timestamptz,
  points int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists occurrences_date_idx on occurrences(date);
create index if not exists occurrences_task_idx on occurrences(task_id);

-- Config simple clave/valor (p.ej. hasta qué fecha se ha generado el calendario)
create table if not exists app_config (
  key text primary key,
  value jsonb not null
);

-- RLS: la app usa la clave "anon" pública sin login (solo dos personas de confianza
-- comparten el enlace). Se abre lectura/escritura completa a esa clave.
alter table tasks enable row level security;
alter table occurrences enable row level security;
alter table app_config enable row level security;

drop policy if exists "tasks_all" on tasks;
create policy "tasks_all" on tasks for all using (true) with check (true);

drop policy if exists "occurrences_all" on occurrences;
create policy "occurrences_all" on occurrences for all using (true) with check (true);

drop policy if exists "app_config_all" on app_config;
create policy "app_config_all" on app_config for all using (true) with check (true);
