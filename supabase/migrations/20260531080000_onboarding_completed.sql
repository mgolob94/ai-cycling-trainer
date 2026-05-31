-- Onboarding completion flag — set true after the final onboarding step so the
-- app can route returning users straight to the main tabs (and resume an
-- interrupted onboarding otherwise).
alter table public.users
  add column if not exists onboarding_completed boolean not null default false;
