-- "Aha moments" — make the AI's reasoning visible.
--   training_plans.reasoning        — why this week's plan looks the way it does
--   training_plans.adaptation_reason — plain-English note when a plan is adapted
--   workout_feedback.progress_signal — one positive, data-driven observation per ride

alter table public.training_plans
  add column if not exists reasoning        jsonb,
  add column if not exists adaptation_reason text;

alter table public.workout_feedback
  add column if not exists progress_signal text;
