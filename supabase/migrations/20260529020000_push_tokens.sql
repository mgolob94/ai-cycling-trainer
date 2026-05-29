-- Device push tokens for notifications. One row per device token; a user can
-- have several (phone + tablet). RLS scopes rows to the owning user.

create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  token      text not null unique,
  platform   text,
  created_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Users can view own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own push tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);
