-- Today's recovery-adapted version of the planned workout, written by the
-- adaptive-training service. Holds { date, original, adapted, warning }.
alter table public.training_plans
  add column if not exists adapted_workout jsonb;
