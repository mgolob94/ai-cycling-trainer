-- Anaerobic work capacity (W') per user, in joules. Default 20000 J.
alter table public.users
  add column if not exists w_prime_total integer not null default 20000;
