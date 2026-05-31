-- Post-workout survey + feedback loop: extend workout_feedback with the planned
-- workout type and the cached AI coach feedback, and enforce one feedback row
-- per ride (user_id, strava_activity_id). The base table is created in
-- 20260531040000_ai_coach.sql.

alter table public.workout_feedback
  add column if not exists planned_workout_type        text,
  add column if not exists coach_feedback              text,
  add column if not exists coach_feedback_generated_at timestamptz;

-- Drop any pre-existing duplicate feedback rows for the same ride (the old
-- insert path allowed them), keeping the most recent — so the unique index can
-- be created. Rows with a null strava_activity_id are untouched (NULLs are
-- distinct under a unique constraint).
delete from public.workout_feedback a
using public.workout_feedback b
where a.strava_activity_id is not null
  and a.user_id = b.user_id
  and a.strava_activity_id = b.strava_activity_id
  and a.created_at < b.created_at;

-- One feedback per ride. A plain unique index (not partial) so the
-- ON CONFLICT (user_id, strava_activity_id) upsert can infer it; NULL
-- strava_activity_id rows remain allowed (NULLs compare as distinct).
-- (Also serves as the lookup index for the ride-detail screen and feedback
-- generation — no separate non-unique index needed on the same columns.)
create unique index if not exists workout_feedback_user_activity_uniq
  on public.workout_feedback (user_id, strava_activity_id);
