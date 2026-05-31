-- Per-month coach-chat usage counter (server-enforced message limits).
alter table public.users
  add column if not exists coach_messages_used_this_month integer not null default 0,
  add column if not exists coach_messages_reset_at timestamptz;
