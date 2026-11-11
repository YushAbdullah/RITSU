-- Ritsu: cloud saving for parent accounts.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Each signed-in user can read and write only their own family's data.

create table if not exists public.ritsu_family_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ritsu_family_data enable row level security;

drop policy if exists "Ritsu own data: read"   on public.ritsu_family_data;
drop policy if exists "Ritsu own data: insert" on public.ritsu_family_data;
drop policy if exists "Ritsu own data: update" on public.ritsu_family_data;
drop policy if exists "Ritsu own data: delete" on public.ritsu_family_data;

create policy "Ritsu own data: read"   on public.ritsu_family_data for select using (auth.uid() = user_id);
create policy "Ritsu own data: insert" on public.ritsu_family_data for insert with check (auth.uid() = user_id);
create policy "Ritsu own data: update" on public.ritsu_family_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Ritsu own data: delete" on public.ritsu_family_data for delete using (auth.uid() = user_id);
