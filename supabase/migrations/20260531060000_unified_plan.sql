-- Unified plan system: one training_plans table carries phase context; phases
-- are determined automatically by phaseEngine.js. There is no separate season
-- plan. A phase_history table audits transitions.

-- Legacy separate table (never created in this project, but drop defensively).
drop table if exists public.season_plans;

-- ---------------------------------------------------------------------------
-- training_plans — add phase + retrospective-tracking columns.
-- (plan_json and adapted_workout already exist; plan_json stays the workout
--  container the app reads, with the same structured object echoed here.)
-- ---------------------------------------------------------------------------
alter table public.training_plans
  add column if not exists phase              text,    -- base | build | peak | recovery | taper
  add column if not exists phase_week         integer,
  add column if not exists phase_total_weeks  integer,
  add column if not exists tss_target         integer,
  add column if not exists week_theme         text,
  add column if not exists coach_intro        text,
  add column if not exists workouts           jsonb,
  add column if not exists completion_pct     integer, -- filled at end of week (0-100)
  add column if not exists tss_achieved       integer, -- actual TSS from Strava
  add column if not exists cache_key          text,    -- week_{YYYY-WW}
  add column if not exists is_cached          boolean default true;

-- ---------------------------------------------------------------------------
-- users — phase state + event/season inputs.
-- (target_event_date and training_days_per_week already exist.)
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists current_phase           text,
  add column if not exists phase_started_at        date,
  add column if not exists target_event_name       text,
  add column if not exists season_start_date       date,
  add column if not exists available_days_per_week integer default 4,
  add column if not exists preferred_long_ride_day text default 'saturday';

-- ---------------------------------------------------------------------------
-- phase_history — audit log of phase transitions.
-- ---------------------------------------------------------------------------
create table if not exists public.phase_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  phase      text not null,
  started_at date not null,
  ended_at   date,
  reason     text not null default 'automatic', -- automatic | event_driven | manual
  created_at timestamptz not null default now()
);
create index if not exists phase_history_user_id_idx on public.phase_history (user_id);

alter table public.phase_history enable row level security;

drop policy if exists "Users can view own phase history" on public.phase_history;
create policy "Users can view own phase history"
  on public.phase_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own phase history" on public.phase_history;
create policy "Users can insert own phase history"
  on public.phase_history for insert
  with check (auth.uid() = user_id);
