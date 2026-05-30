-- Recovery & readiness: HRV / sleep inputs, a derived daily recovery score, and
-- connections to external data sources (Apple Health / Garmin / Whoop).
-- RLS is enabled on every table and scopes rows to the owning user.

-- ---------------------------------------------------------------------------
-- hrv_readings — heart-rate-variability samples (RMSSD) + resting HR.
-- ---------------------------------------------------------------------------
create table public.hrv_readings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  recorded_at  timestamptz not null,
  hrv_ms       real,
  resting_hr   integer,
  source       text,
  raw_data     jsonb,
  created_at   timestamptz not null default now()
);

create index hrv_readings_user_recorded_idx
  on public.hrv_readings (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- sleep_sessions — one sleep period (dated by the evening before).
-- ---------------------------------------------------------------------------
create table public.sleep_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  date          date not null,
  sleep_start   timestamptz,
  sleep_end     timestamptz,
  duration_min  integer,
  deep_min      integer,
  rem_min       integer,
  light_min     integer,
  awake_min     integer,
  sleep_score   integer,
  source        text,
  raw_data      jsonb,
  created_at    timestamptz not null default now()
);

create index sleep_sessions_user_date_idx
  on public.sleep_sessions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- recovery_scores — our derived daily readiness score (one row per user/day).
-- ---------------------------------------------------------------------------
create table public.recovery_scores (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  date                date not null,
  recovery_score      integer,
  hrv_score           integer,
  sleep_score         integer,
  training_load_score integer,
  readiness_label     text,
  recommendation      text,
  created_at          timestamptz not null default now(),
  unique (user_id, date)
);

create index recovery_scores_user_date_idx
  on public.recovery_scores (user_id, date desc);

-- ---------------------------------------------------------------------------
-- source_connections — link state + (encrypted) tokens for external sources.
-- One row per user per source.
-- ---------------------------------------------------------------------------
create table public.source_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  source        text not null,
  is_connected  boolean not null default false,
  last_sync_at  timestamptz,
  access_token  text,
  refresh_token text,
  config_json   jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, source)
);

create index source_connections_user_idx
  on public.source_connections (user_id, source);

-- ===========================================================================
-- Row Level Security — owner-scoped (auth.uid() = user_id) on every table.
-- ===========================================================================
alter table public.hrv_readings       enable row level security;
alter table public.sleep_sessions     enable row level security;
alter table public.recovery_scores    enable row level security;
alter table public.source_connections enable row level security;

-- hrv_readings
create policy "Users can view own hrv readings"
  on public.hrv_readings for select using (auth.uid() = user_id);
create policy "Users can insert own hrv readings"
  on public.hrv_readings for insert with check (auth.uid() = user_id);
create policy "Users can update own hrv readings"
  on public.hrv_readings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own hrv readings"
  on public.hrv_readings for delete using (auth.uid() = user_id);

-- sleep_sessions
create policy "Users can view own sleep sessions"
  on public.sleep_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sleep sessions"
  on public.sleep_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sleep sessions"
  on public.sleep_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own sleep sessions"
  on public.sleep_sessions for delete using (auth.uid() = user_id);

-- recovery_scores
create policy "Users can view own recovery scores"
  on public.recovery_scores for select using (auth.uid() = user_id);
create policy "Users can insert own recovery scores"
  on public.recovery_scores for insert with check (auth.uid() = user_id);
create policy "Users can update own recovery scores"
  on public.recovery_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own recovery scores"
  on public.recovery_scores for delete using (auth.uid() = user_id);

-- source_connections
create policy "Users can view own source connections"
  on public.source_connections for select using (auth.uid() = user_id);
create policy "Users can insert own source connections"
  on public.source_connections for insert with check (auth.uid() = user_id);
create policy "Users can update own source connections"
  on public.source_connections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own source connections"
  on public.source_connections for delete using (auth.uid() = user_id);
