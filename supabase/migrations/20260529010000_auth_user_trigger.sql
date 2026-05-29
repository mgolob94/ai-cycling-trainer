-- Auto-create a public.users profile row whenever someone signs up via Supabase
-- Auth. Without this, a new auth.users record has no matching profile and
-- GET /api/users/me returns empty.
--
-- The function runs as SECURITY DEFINER so it can insert into public.users
-- despite RLS. search_path is pinned to '' (empty) to avoid search-path
-- hijacking, so every object below is schema-qualified.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, age, weight_kg, fitness_level, goal)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    nullif(new.raw_user_meta_data ->> 'weight_kg', '')::real,
    -- Only accept values that satisfy the column check constraints; anything
    -- else is stored as null so a bad metadata value can't break signup.
    case
      when new.raw_user_meta_data ->> 'fitness_level'
        in ('beginner', 'intermediate', 'advanced')
      then new.raw_user_meta_data ->> 'fitness_level'
    end,
    case
      when new.raw_user_meta_data ->> 'goal'
        in ('endurance', 'speed', 'weight loss')
      then new.raw_user_meta_data ->> 'goal'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Fire once per new auth user.
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
