-- Proof of Work — Gmail scan, write path
--
-- 0004 made the ciphertext column unreadable from the app's client, which
-- was right, but an INSERT ... ON CONFLICT DO UPDATE counts as READING the
-- columns it updates, so the callback's upsert failed with "permission
-- denied". Symmetry fixes it: the token is written the same way it is read,
-- through a definer function that acts only on the caller's own row.

create or replace function public.gmail_connect(p_email text, p_token_enc text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_email is null or p_email = '' or p_token_enc is null or p_token_enc = '' then
    raise exception 'email and token are required';
  end if;
  insert into public.gmail_connections (owner_id, email, refresh_token_enc, connected_at, last_scan_at)
  values (auth.uid(), p_email, p_token_enc, now(), null)
  on conflict (owner_id) do update
    set email = excluded.email,
        refresh_token_enc = excluded.refresh_token_enc,
        connected_at = now(),
        last_scan_at = null;
end;
$$;

revoke all on function public.gmail_connect(text, text) from public;
grant execute on function public.gmail_connect(text, text) to authenticated;

-- With the function owning writes, the client needs no insert/update on the
-- table at all — it keeps read (non-secret columns) and delete (disconnect).
-- The scan's last_scan_at stamp moves into a function too, for the same
-- reason: the row's other columns stay out of the app's reach entirely.
revoke insert, update on public.gmail_connections from authenticated;
drop policy if exists "insert own gmail connection" on public.gmail_connections;
drop policy if exists "update own gmail connection" on public.gmail_connections;

create or replace function public.gmail_mark_scanned()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.gmail_connections set last_scan_at = now() where owner_id = auth.uid();
$$;

revoke all on function public.gmail_mark_scanned() from public;
grant execute on function public.gmail_mark_scanned() to authenticated;
