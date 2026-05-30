-- Dedup keys for source syncs (Apple Health / Garmin / Whoop): a given sample
-- timestamp/night from a given source maps to one row, so re-syncing upserts.
alter table public.hrv_readings
  add constraint hrv_readings_user_recorded_source_key unique (user_id, recorded_at, source);

alter table public.sleep_sessions
  add constraint sleep_sessions_user_date_source_key unique (user_id, date, source);
