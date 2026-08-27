-- Proof of Work — multi-tenant
--
-- Turns the single-user log into one anyone can sign up for.
--
-- The isolation rule is one line, repeated on every verb: a row belongs to
-- `owner_id`, and a signed-in user touches only rows where `owner_id` is their
-- own uid. `anon` loses all direct access to `applications` — the public side
-- now goes exclusively through the two share functions at the bottom, which
-- take a 96-bit unguessable token and return only rows whose owner has opted
-- in to sharing.

-- ---------------------------------------------------------------------------
-- 1. Ownership
-- ---------------------------------------------------------------------------

alter table public.applications
  add column owner_id uuid references auth.users (id) on delete cascade;

-- Anything logged during the single-user era belongs to the one allowlisted
-- account. If somehow no admin exists, the rows are orphans and get dropped
-- rather than left readable-by-nobody.
update public.applications
set owner_id = (select user_id from public.app_admins order by added_at limit 1)
where owner_id is null;

delete from public.applications where owner_id is null;

alter table public.applications
  alter column owner_id set not null,
  alter column owner_id set default auth.uid();

drop index if exists public.applications_applied_on_idx;
create index applications_owner_applied_idx
  on public.applications (owner_id, applied_on desc);

-- ---------------------------------------------------------------------------
-- 2. Profiles and share tokens
-- ---------------------------------------------------------------------------

-- 12 random bytes -> 16 base64 chars, no padding, made URL-safe. ~96 bits of
-- entropy, so the share URL is unguessable and needs no other access control.
create or replace function public.new_share_token()
returns text
language sql
volatile
as $$
  select replace(replace(encode(gen_random_bytes(12), 'base64'), '/', '_'), '+', '-');
$$;

revoke all on function public.new_share_token() from public;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  headline     text check (char_length(headline) <= 140),
  share_token  text not null unique default public.new_share_token(),
  is_shared    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Every new account gets a profile automatically; the app never has to
-- remember to create one, and a half-registered user cannot exist.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Policies — retire the allowlist, isolate by owner
-- ---------------------------------------------------------------------------

drop policy "applications are world readable" on public.applications;
drop policy "admins can insert" on public.applications;
drop policy "admins can update" on public.applications;
drop policy "admins can delete" on public.applications;
drop policy "you can see your own allowlist row" on public.app_admins;
drop table public.app_admins;

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: the signup trigger owns creation.
-- No delete policy: profiles cascade when the auth user is deleted.

create policy "read own applications"
  on public.applications for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "insert own applications"
  on public.applications for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "update own applications"
  on public.applications for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "delete own applications"
  on public.applications for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. The public share path
-- ---------------------------------------------------------------------------
--
-- These two functions are SECURITY DEFINER and callable by `anon`. That is
-- deliberate and is the ONLY way an unauthenticated visitor reaches any row.
-- It is safe because each one:
--   * takes the token as a parameter and matches it exactly — no wildcards,
--     no user-supplied SQL, no way to widen the result set;
--   * filters on `is_shared`, so revoking a share link takes effect instantly;
--   * returns a fixed column list that excludes owner_id, timestamps and every
--     other internal field.
-- The alternative — a service-role key held by the web app — would put a
-- credential with full database access into the deployment. This keeps the
-- blast radius to "one token reads one person's opted-in log".

create or replace function public.shared_owner(p_token text)
returns table (display_name text, headline text)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, p.headline
  from public.profiles p
  where p.share_token = p_token
    and p.is_shared;
$$;

create or replace function public.shared_applications(p_token text)
returns table (
  id          uuid,
  role        text,
  company     text,
  description text,
  location    text,
  salary      text,
  applied_on  date,
  status      public.application_status
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.role, a.company, a.description,
         a.location, a.salary, a.applied_on, a.status
  from public.applications a
  join public.profiles p on p.id = a.owner_id
  where p.share_token = p_token
    and p.is_shared
  order by a.applied_on desc;
$$;

revoke all on function public.shared_owner(text) from public;
revoke all on function public.shared_applications(text) from public;
grant execute on function public.shared_owner(text) to anon, authenticated;
grant execute on function public.shared_applications(text) to anon, authenticated;

-- Burn the current link and mint a new one. Runs as definer so the token
-- generator stays out of reach, but acts only on the caller's own row.
create or replace function public.rotate_share_token()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fresh text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set share_token = public.new_share_token()
  where id = auth.uid()
  returning share_token into fresh;

  return fresh;
end;
$$;

revoke all on function public.rotate_share_token() from public;
grant execute on function public.rotate_share_token() to authenticated;
