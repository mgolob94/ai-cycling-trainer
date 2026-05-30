-- Strava athlete id, so webhook events (owner_id) can map to our user.
alter table public.strava_connections
  add column if not exists athlete_id text;

create index if not exists strava_connections_athlete_id_idx
  on public.strava_connections (athlete_id);
