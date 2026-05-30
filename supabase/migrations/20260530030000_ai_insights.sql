-- Stored AI coaching analysis results (weekly summaries, trend analyses, ...).
create table if not exists public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  insight_type text not null,
  content_json jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists ai_insights_user_id_type_idx
  on public.ai_insights (user_id, insight_type, created_at desc);

alter table public.ai_insights enable row level security;

create policy "Users can view own ai insights"
  on public.ai_insights for select
  using (auth.uid() = user_id);

create policy "Users can insert own ai insights"
  on public.ai_insights for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own ai insights"
  on public.ai_insights for delete
  using (auth.uid() = user_id);
