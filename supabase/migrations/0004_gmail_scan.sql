-- Proof of Work — Gmail scan
--
-- Lets a signed-in user connect their Gmail (read-only) and scan it for
-- replies to the applications in their log. Two tables, same isolation rule as
-- everything else: a row belongs to `owner_id`, and only that user touches it.
--
-- The one new kind of secret is the Google refresh token. It is stored
-- ENCRYPTED (AES-256-GCM, key held only in the web app's environment) and the
-- ciphertext column is not readable through the normal table grant at all:
-- column privileges drop it from what `authenticated` can select, and the only
-- way to read it is `gmail_refresh_token()`, a security-definer function that
-- returns the caller's own row and nothing else. So: the browser can see THAT
-- Gmail is connected and which address, the server route can fetch the
-- ciphertext for the signed-in user only, and nothing can read anyone else's.
-- No service-role key is involved anywhere.

-- ---------------------------------------------------------------------------
-- 1. The connection
-- ---------------------------------------------------------------------------

create table public.gmail_connections (
  owner_id          uuid primary key references auth.users (id) on delete cascade
                    default auth.uid(),
  email             text not null,
  refresh_token_enc text not null,
  connected_at      timestamptz not null default now(),
  last_scan_at      timestamptz
);

alter table public.gmail_connections enable row level security;

create policy "read own gmail connection"
  on public.gmail_connections for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "insert own gmail connection"
  on public.gmail_connections for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "update own gmail connection"
  on public.gmail_connections for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "delete own gmail connection"
  on public.gmail_connections for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Column privileges: the ciphertext is write-only from the table's point of
-- view. `select *` from a client fails; selecting the listed columns works.
revoke select on public.gmail_connections from authenticated;
grant select (owner_id, email, connected_at, last_scan_at)
  on public.gmail_connections to authenticated;

-- The ONLY read path for the ciphertext. Definer so it can see the column;
-- filtered on auth.uid() so it can only ever return the caller's own.
create or replace function public.gmail_refresh_token()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select refresh_token_enc
  from public.gmail_connections
  where owner_id = auth.uid();
$$;

revoke all on function public.gmail_refresh_token() from public;
grant execute on function public.gmail_refresh_token() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. What a scan found
-- ---------------------------------------------------------------------------
--
-- One row per Gmail message the scan decided was about the job search. We
-- keep headers and a classification, never the body: enough to show "Acme
-- wrote back on the 14th and it reads like a rejection", and to link straight
-- to the message in Gmail, without copying anyone's mail into our database.
-- `application_id` is null for a message that looked job-shaped but matched
-- nothing in the log — the "possibly missed" pile.

create type public.email_kind as enum
  ('interview', 'rejection', 'confirmation', 'reply', 'other');

create table public.email_matches (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade
                   default auth.uid(),
  application_id   uuid references public.applications (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id  text not null,
  from_name        text,
  from_address     text not null,
  subject          text,
  snippet          text check (char_length(snippet) <= 300),
  received_at      timestamptz not null,
  kind             public.email_kind not null default 'other',
  dismissed        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (owner_id, gmail_message_id)
);

create index email_matches_owner_received_idx
  on public.email_matches (owner_id, received_at desc);

alter table public.email_matches enable row level security;

create policy "read own email matches"
  on public.email_matches for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "insert own email matches"
  on public.email_matches for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "update own email matches"
  on public.email_matches for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "delete own email matches"
  on public.email_matches for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Nothing here is reachable by `anon`, and none of it is exposed through the
-- share functions: what your inbox said is yours, not part of the public log.
