-- Proof of Work — schema
--
-- Security model, in one line: the log is world-readable, and writable only by
-- a signed-in user whose id sits in public.app_admins. The anon key shipped to
-- the browser can therefore do nothing but SELECT.
--
-- The allowlist protects itself. app_admins has exactly one policy — a user may
-- read their OWN row and nothing else — and no INSERT/UPDATE/DELETE policy at
-- all, so nobody can enumerate the writers or add themselves. That single
-- policy is enough for the applications policies below to test membership with
-- a plain EXISTS, which is why this schema needs no SECURITY DEFINER function
-- and exposes no RPC.

create type public.application_status as enum (
  'applied', 'heard', 'interview', 'rejected', 'ghosted'
);

create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (char_length(role) between 1 and 160),
  company     text check (char_length(company) <= 160),
  description text check (char_length(description) <= 2000),
  location    text check (char_length(location) <= 160),
  salary      text check (char_length(salary) <= 80),
  applied_on  date not null default current_date,
  status      public.application_status not null default 'applied',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index applications_applied_on_idx on public.applications (applied_on desc);

create table public.app_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.applications enable row level security;

-- Read your own membership, nothing else. No write policy exists, so the
-- allowlist is service-role-only to modify.
create policy "you can see your own allowlist row"
  on public.app_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "applications are world readable"
  on public.applications for select
  to anon, authenticated
  using (true);

-- auth.uid() is wrapped in a subselect so Postgres evaluates it once per
-- statement instead of once per row.
create policy "admins can insert"
  on public.applications for insert
  to authenticated
  with check (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  );

create policy "admins can update"
  on public.applications for update
  to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  );

create policy "admins can delete"
  on public.applications for delete
  to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  );

-- Keep updated_at honest without trusting the client to send it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();
