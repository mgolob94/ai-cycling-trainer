-- AI coach core: coach style preference, post-workout feedback, notification
-- log, and goal tracking. RLS owner-scoped on every new table.

-- Coach communication style (prompt 10).
alter table public.users
  add column if not exists coach_style text not null default 'scientist';

-- ---------------------------------------------------------------------------
-- workout_feedback — post-workout survey (the AI coach's learning loop).
-- ---------------------------------------------------------------------------
create table if not exists public.workout_feedback (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  workout_date       date,
  strava_activity_id text,
  completion_status  text,        -- 'completed' | 'partial' | 'skipped'
  perceived_effort   integer,     -- 1–5
  post_feeling       integer,     -- 1–3
  planned_tss        real,
  actual_tss         real,
  created_at         timestamptz not null default now()
);
create index if not exists workout_feedback_user_date_idx
  on public.workout_feedback (user_id, workout_date desc);

-- ---------------------------------------------------------------------------
-- notifications_sent — anti-spam ledger for the notification engine.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications_sent (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  notification_type text not null,
  sent_at           timestamptz not null default now(),
  was_opened        boolean not null default false,
  deep_link         text
);
create index if not exists notifications_sent_user_type_idx
  on public.notifications_sent (user_id, notification_type, sent_at desc);

-- ---------------------------------------------------------------------------
-- goals — targets the coach trains toward.
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  goal_type          text not null,   -- ftp_target | event | consistency | distance | fitness
  title              text,
  target_date        date,
  target_ftp         integer,
  target_distance_km real,
  target_event_name  text,
  current_progress   integer not null default 0,
  status             text not null default 'active',  -- active | completed | abandoned
  created_at         timestamptz not null default now()
);
create index if not exists goals_user_status_idx on public.goals (user_id, status);

-- RLS
alter table public.workout_feedback   enable row level security;
alter table public.notifications_sent enable row level security;
alter table public.goals              enable row level security;

create policy "own workout_feedback select" on public.workout_feedback for select using (auth.uid() = user_id);
create policy "own workout_feedback insert" on public.workout_feedback for insert with check (auth.uid() = user_id);
create policy "own workout_feedback update" on public.workout_feedback for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout_feedback delete" on public.workout_feedback for delete using (auth.uid() = user_id);

create policy "own notifications_sent select" on public.notifications_sent for select using (auth.uid() = user_id);
create policy "own notifications_sent insert" on public.notifications_sent for insert with check (auth.uid() = user_id);
create policy "own notifications_sent delete" on public.notifications_sent for delete using (auth.uid() = user_id);

create policy "own goals select" on public.goals for select using (auth.uid() = user_id);
create policy "own goals insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "own goals update" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals delete" on public.goals for delete using (auth.uid() = user_id);
