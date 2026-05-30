-- Periodization inputs on the user profile.
alter table public.users
  add column if not exists target_event_date      date,
  add column if not exists training_days_per_week  integer default 4;
