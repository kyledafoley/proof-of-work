-- Proof of Work — keep last_scan_at across a reconnect
--
-- Google drops a testing-mode app's grant every seven days, so reconnecting
-- is routine. 0005's gmail_connect() reset last_scan_at to null on every
-- connect, which turned the next scan into a full one. A reconnect is the
-- same mailbox; the watermark stays.

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
        -- A different mailbox starts over; the same one keeps its watermark.
        last_scan_at = case
          when gmail_connections.email = excluded.email then gmail_connections.last_scan_at
          else null
        end;
end;
$$;
