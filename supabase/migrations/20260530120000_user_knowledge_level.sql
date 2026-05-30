-- Tracks how familiar the user is with cycling metrics so the UI can adapt
-- (beginner = plain language only … advanced = numbers by default). Synced from
-- the mobile client; defaults to the most cautious level.
alter table public.users
  add column if not exists knowledge_level text not null default 'beginner';
