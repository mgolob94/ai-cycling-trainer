-- Progress tracking: FTP tests, weekly performance metrics, and personal
-- records. RLS is enabled on every table and scopes rows to the owning user.

-- ---------------------------------------------------------------------------
-- ftp_tests — recorded FTP (functional threshold power) tests over time.
-- ---------------------------------------------------------------------------
create table public.ftp_tests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  ftp_watts     integer,
  weight_kg     real,
  watts_per_kg  real,
  test_date     date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index ftp_tests_user_id_idx on public.ftp_tests (user_id);
create index ftp_tests_user_id_test_date_idx on public.ftp_tests (user_id, test_date desc);

-- ---------------------------------------------------------------------------
-- performance_metrics — weekly training-load aggregates (one row per week).
-- ---------------------------------------------------------------------------
create table public.performance_metrics (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  week_start         date not null,
  tss                real,
  atl                real,
  ctl                real,
  tsb                real,
  total_distance_km  real,
  total_duration_sec integer,
  total_elevation_m  real,
  avg_power_w        real,
  ride_count         integer,
  created_at         timestamptz not null default now(),
  unique (user_id, week_start)
);

create index performance_metrics_user_id_idx on public.performance_metrics (user_id);

-- ---------------------------------------------------------------------------
-- personal_records — best efforts (history kept; multiple rows per type ok).
-- record_type e.g. '5min_power', '20min_power', '1hr_power', 'longest_ride',
-- 'fastest_climb'. unit e.g. 'watts', 'km', 'min'.
-- ---------------------------------------------------------------------------
create table public.personal_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  record_type        text not null,
  value              real,
  unit               text,
  strava_activity_id text,
  achieved_date      date,
  created_at         timestamptz not null default now()
);

create index personal_records_user_id_idx on public.personal_records (user_id);
create index personal_records_user_id_type_idx on public.personal_records (user_id, record_type);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.ftp_tests enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.personal_records enable row level security;

-- ftp_tests
create policy "Users can view own ftp tests"
  on public.ftp_tests for select
  using (auth.uid() = user_id);

create policy "Users can insert own ftp tests"
  on public.ftp_tests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ftp tests"
  on public.ftp_tests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ftp tests"
  on public.ftp_tests for delete
  using (auth.uid() = user_id);

-- performance_metrics
create policy "Users can view own performance metrics"
  on public.performance_metrics for select
  using (auth.uid() = user_id);

create policy "Users can insert own performance metrics"
  on public.performance_metrics for insert
  with check (auth.uid() = user_id);

create policy "Users can update own performance metrics"
  on public.performance_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own performance metrics"
  on public.performance_metrics for delete
  using (auth.uid() = user_id);

-- personal_records
create policy "Users can view own personal records"
  on public.personal_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal records"
  on public.personal_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal records"
  on public.personal_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal records"
  on public.personal_records for delete
  using (auth.uid() = user_id);
