-- Recovery: morning check-in inputs on the daily score; feature flags so
-- hidden screens (recovery) can be revealed without an app release.

-- ---------------------------------------------------------------------------
-- recovery_scores — subjective morning check-in (1–5) + its source.
-- ---------------------------------------------------------------------------
alter table public.recovery_scores
  add column if not exists subjective_feeling integer, -- 1 (wrecked) .. 5 (great)
  add column if not exists check_in_source    text;    -- apple_health | manual

-- ---------------------------------------------------------------------------
-- feature_flags — server-controlled visibility toggles (no app redeploy).
-- ---------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key        text primary key,
  enabled    boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled) values
  ('recovery_screen', false),
  ('coach_chat', false),
  ('monthly_review', false),
  ('power_duration_curve', false),
  ('nutrition_screen', true),
  ('strength_in_plan', true),
  ('morning_checkin', true),
  ('apple_health_sync', true)
on conflict (key) do nothing;

alter table public.feature_flags enable row level security;

drop policy if exists "Anyone authenticated can read flags" on public.feature_flags;
create policy "Anyone authenticated can read flags"
  on public.feature_flags for select
  using (true);
