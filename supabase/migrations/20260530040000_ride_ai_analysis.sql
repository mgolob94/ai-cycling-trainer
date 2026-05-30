-- Per-ride AI analysis (execution score, feedback, etc.).
alter table public.rides
  add column if not exists ai_analysis jsonb;
