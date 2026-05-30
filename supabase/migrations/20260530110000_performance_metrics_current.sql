-- Store the user's *current* training-load snapshot (as of the last full-history
-- recalculation) alongside each weekly row in performance_metrics. The values
-- are identical across a user's rows — denormalized so the latest week alone
-- yields today's fitness/fatigue/form without a separate query.
alter table public.performance_metrics
  add column if not exists current_ctl real,
  add column if not exists current_atl real,
  add column if not exists current_tsb real;
