-- Sync tracking for Strava connections, rides, and a per-sync log.

-- strava_connections: progress + status of syncing.
alter table public.strava_connections
  add column if not exists last_sync_at                timestamptz,
  add column if not exists last_activity_sync_at       timestamptz,
  add column if not exists total_activities_synced     integer not null default 0,
  add column if not exists initial_sync_completed      boolean not null default false,
  add column if not exists initial_sync_started_at     timestamptz,
  add column if not exists initial_sync_progress       integer not null default 0,
  add column if not exists initial_sync_total_estimate integer,
  add column if not exists sync_status                 text not null default 'idle',
  add column if not exists sync_error                  text;

-- rides: provenance + processing flags + cached power data.
alter table public.rides
  add column if not exists synced_at        timestamptz not null default now(),
  add column if not exists is_processed     boolean not null default false,
  add column if not exists power_curve      jsonb,
  add column if not exists raw_strava_data  jsonb;

-- Per-sync log.
create table if not exists public.sync_log (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  sync_type           text,
  started_at          timestamptz,
  completed_at        timestamptz,
  activities_fetched  integer,
  activities_new      integer,
  activities_updated  integer,
  status              text,
  error_message       text,
  duration_sec        integer
);

create index if not exists sync_log_user_started_idx
  on public.sync_log (user_id, started_at desc);

alter table public.sync_log enable row level security;

create policy "Users can view own sync log"
  on public.sync_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own sync log"
  on public.sync_log for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sync log"
  on public.sync_log for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sync log"
  on public.sync_log for delete
  using (auth.uid() = user_id);
