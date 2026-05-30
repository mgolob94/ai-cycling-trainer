-- Universal cache for AI-generated analyses (dedupe identical generations and
-- control cost). One row per (user, analysis_type, cache_key).
--
-- cache_key format per analysis_type:
--   weekly_summary : 'week_{YYYY-WW}'          (ISO week)
--   ride_analysis  : 'ride_{strava_activity_id}'
--   trend_analysis : 'trend_{YYYY-MM}'          (monthly)
--   recommendations: 'rec_{YYYY-WW}'
--   periodization  : 'period_{goal}_{YYYY-MM}'
--   rider_profile  : 'profile_{YYYY-MM}'
--   ftp_insight    : 'ftp_{ftp_test_id}'

create table public.ai_analysis_cache (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  analysis_type     text not null,
  cache_key         text not null,
  content_json      jsonb not null,
  input_hash        text,
  model_used        text,
  tokens_used       integer,
  generated_at      timestamptz not null default now(),
  expires_at        timestamptz,
  is_valid          boolean not null default true,
  subscription_plan text
);

-- One cache entry per exact input.
create unique index ai_analysis_cache_unique_idx
  on public.ai_analysis_cache (user_id, analysis_type, cache_key);

-- Lookup by type + freshness.
create index ai_analysis_cache_lookup_idx
  on public.ai_analysis_cache (user_id, analysis_type, expires_at);

alter table public.ai_analysis_cache enable row level security;

-- Users may read only their own cache entries. Writes happen server-side with
-- the service-role key (which bypasses RLS).
create policy "Users can view own ai cache"
  on public.ai_analysis_cache for select
  using (auth.uid() = user_id);
