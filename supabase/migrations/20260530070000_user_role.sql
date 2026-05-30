-- Role for admin-only endpoints (e.g. platform-wide cache stats).
alter table public.users
  add column if not exists role text not null default 'user';
