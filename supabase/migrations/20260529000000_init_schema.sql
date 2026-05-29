-- AI Cycling Trainer — initial schema
-- Tables: users, strava_connections, rides, training_plans
-- Row Level Security is enabled on every table; policies restrict each row to
-- its owning user (auth.uid()). The backend's service-role key bypasses RLS for
-- trusted server-side work (webhooks, background syncs).

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- id mirrors auth.users(id) so RLS can compare against auth.uid().
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique not null,
  age           integer,
  weight_kg     real,
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  goal          text check (goal in ('endurance', 'speed', 'weight loss')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- strava_connections
-- One Strava connection per user. Tokens are encrypted at the application
-- layer before being stored here.
-- ---------------------------------------------------------------------------
create table public.strava_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.users (id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null
);

create index strava_connections_user_id_idx on public.strava_connections (user_id);

-- ---------------------------------------------------------------------------
-- rides
-- Imported Strava activities. strava_id is unique to support idempotent upserts.
-- ---------------------------------------------------------------------------
create table public.rides (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  strava_id      text not null unique,
  distance_km    real,
  duration_sec   integer,
  avg_power_w    real,
  avg_heart_rate real,
  elevation_m    real,
  ride_date      date
);

create index rides_user_id_idx on public.rides (user_id);
create index rides_user_id_ride_date_idx on public.rides (user_id, ride_date desc);

-- ---------------------------------------------------------------------------
-- training_plans
-- One AI-generated plan per user per week.
-- ---------------------------------------------------------------------------
create table public.training_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  week_start   date not null,
  plan_json    jsonb not null,
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index training_plans_user_id_idx on public.training_plans (user_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.users enable row level security;
alter table public.strava_connections enable row level security;
alter table public.rides enable row level security;
alter table public.training_plans enable row level security;

-- users: a user may only see and modify their own row.
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.users for delete
  using (auth.uid() = id);

-- strava_connections: scoped to the owning user.
create policy "Users can view own strava connection"
  on public.strava_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own strava connection"
  on public.strava_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own strava connection"
  on public.strava_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own strava connection"
  on public.strava_connections for delete
  using (auth.uid() = user_id);

-- rides: scoped to the owning user.
create policy "Users can view own rides"
  on public.rides for select
  using (auth.uid() = user_id);

create policy "Users can insert own rides"
  on public.rides for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rides"
  on public.rides for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own rides"
  on public.rides for delete
  using (auth.uid() = user_id);

-- training_plans: scoped to the owning user.
create policy "Users can view own training plans"
  on public.training_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own training plans"
  on public.training_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own training plans"
  on public.training_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own training plans"
  on public.training_plans for delete
  using (auth.uid() = user_id);
