import Colophon from "@/components/Colophon";
import Dashboard from "@/components/Dashboard";
import { getApplications } from "@/lib/supabase/public";

/** Re-fetch at most twice a minute; a job log does not need per-request freshness. */
export const revalidate = 30;

export default async function Home() {
  const { apps, error } = await getApplications();

  return (
    <Dashboard apps={apps}>
      {error && (
        <p className="form-error">
          Could not load the log right now: {error}
        </p>
      )}
      <Colophon repoUrl={process.env.NEXT_PUBLIC_REPO_URL} />
    </Dashboard>
  );
}
