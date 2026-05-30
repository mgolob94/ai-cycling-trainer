-- Advanced power metrics on rides + all-time power-duration bests.

alter table public.rides
  add column if not exists normalized_power  real,
  add column if not exists xpower            real,
  add column if not exists variability_index real,
  add column if not exists efficiency_factor real,
  add column if not exists power_curve        jsonb;

-- All-time best average power per duration, across all of a user's rides.
create table if not exists public.power_duration_bests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  duration_sec  integer not null,
  power_watts   real,
  achieved_date date,
  created_at    timestamptz not null default now(),
  unique (user_id, duration_sec)
);

create index if not exists power_duration_bests_user_id_idx
  on public.power_duration_bests (user_id);

alter table public.power_duration_bests enable row level security;

create policy "Users can view own power bests"
  on public.power_duration_bests for select
  using (auth.uid() = user_id);

create policy "Users can insert own power bests"
  on public.power_duration_bests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own power bests"
  on public.power_duration_bests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own power bests"
  on public.power_duration_bests for delete
  using (auth.uid() = user_id);
