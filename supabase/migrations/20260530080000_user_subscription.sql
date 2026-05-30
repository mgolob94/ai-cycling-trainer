-- Subscription fields for future plan-based AI refresh limits (no billing yet).
alter table public.users
  add column if not exists subscription_plan            text not null default 'free',
  add column if not exists subscription_expires_at      timestamptz,
  add column if not exists ai_refreshes_used_this_month  integer not null default 0,
  add column if not exists ai_refreshes_reset_at         timestamptz;
