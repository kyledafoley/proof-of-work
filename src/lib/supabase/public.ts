import { createClient } from "@supabase/supabase-js";
import type { Application, SharedOwner } from "@/lib/types";

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Cookie-free client for pages a logged-out visitor can see. Skipping cookies
 * keeps those routes statically renderable and served from cache.
 */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export type SharedLog = {
  owner: SharedOwner;
  apps: Application[];
  /** Distinguishes "no such link" from "the link works, the log is empty". */
  found: boolean;
  error: string | null;
};

const EMPTY: SharedLog = {
  owner: { display_name: null, headline: null },
  apps: [],
  found: false,
  error: null,
};

/**
 * Reads one person's shared log by its unlisted token.
 *
 * Both calls are RPCs rather than table selects: `anon` has no direct access to
 * `applications` at all. The database functions do the token match, so an
 * invalid or revoked token simply returns nothing — there is no code path here
 * that could widen the query.
 */
export async function getSharedLog(token: string): Promise<SharedLog> {
  if (!hasSupabaseEnv) {
    return { ...EMPTY, error: "Supabase environment variables are not set." };
  }
  if (!token) return EMPTY;

  const supabase = publicClient();

  const [ownerResult, appsResult] = await Promise.all([
    supabase.rpc("shared_owner", { p_token: token }),
    supabase.rpc("shared_applications", { p_token: token }),
  ]);

  if (ownerResult.error) return { ...EMPTY, error: ownerResult.error.message };
  if (appsResult.error) return { ...EMPTY, error: appsResult.error.message };

  const ownerRow = (ownerResult.data ?? [])[0] as SharedOwner | undefined;
  if (!ownerRow) return EMPTY;

  return {
    owner: ownerRow,
    apps: (appsResult.data ?? []) as Application[],
    found: true,
    error: null,
  };
}
