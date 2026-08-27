-- Supabase grants EXECUTE on new public-schema functions to `anon` and
-- `authenticated` by default, so `revoke ... from public` in 0002 did not
-- actually close them off. This revokes the explicit grants and pins an empty
-- search_path on the one function that was missing it.
--
-- What is deliberately left reachable afterwards: shared_owner() and
-- shared_applications() by `anon`. Those two ARE the public share path. Each
-- takes the token as a parameter, matches it exactly, filters on is_shared, and
-- returns a fixed column list — so the most any caller can do is read one
-- person's opted-in log, and only while holding a 96-bit token. The alternative
-- (a service-role key in the web app) would be strictly worse.

-- A trigger function should never be callable over the REST API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Token generation is an implementation detail of the definer functions.
-- search_path is empty and every non-builtin call is schema-qualified, so this
-- cannot be redirected by a caller's search_path. pgcrypto lives in
-- `extensions` on Supabase, not `public`.
create or replace function public.new_share_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(
           replace(encode(extensions.gen_random_bytes(12), 'base64'), '/', '_'),
           '+', '-'
         );
$$;

revoke all on function public.new_share_token() from public, anon, authenticated;

-- Rotating a share link requires being signed in; there is nothing for a
-- logged-out caller to rotate.
revoke all on function public.rotate_share_token() from public, anon;
grant execute on function public.rotate_share_token() to authenticated;
