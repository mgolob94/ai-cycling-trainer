-- Store source-specific extras alongside the derived recovery score, e.g.
-- Garmin Body Battery ({ "garmin_body_battery": 72 }).
alter table public.recovery_scores
  add column if not exists raw_data jsonb;
