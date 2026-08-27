import { createClient } from "@supabase/supabase-js";
import type { Application } from "@/lib/types";

const SELECT =
  "id, role, company, description, location, salary, applied_on, status";

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Cookie-free client for the public page. Skipping cookies keeps the route
 * statically renderable, so the dashboard is served from the edge cache and
 * revalidated on a timer rather than rebuilt per visitor.
 */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function getApplications(): Promise<{
  apps: Application[];
  error: string | null;
}> {
  if (!hasSupabaseEnv) {
    return { apps: [], error: "Supabase environment variables are not set." };
  }

  const { data, error } = await publicClient()
    .from("applications")
    .select(SELECT)
    .order("applied_on", { ascending: false });

  if (error) return { apps: [], error: error.message };
  return { apps: (data ?? []) as Application[], error: null };
}

export { SELECT as APPLICATION_COLUMNS };
