import type { Metadata } from "next";
import Link from "next/link";
import Dashboard from "@/components/Dashboard";
import { getSharedLog } from "@/lib/supabase/public";

export const revalidate = 30;

/** Unlisted links should never turn up in a search result. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedLogPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { owner, apps, found, error } = await getSharedLog(token);

  if (!found) {
    return (
      <main className="page">
        <div className="empty" style={{ marginTop: "12vh" }}>
          <h3>This link isn&apos;t active</h3>
          <p>
            {error
              ? "The log couldn't be loaded right now. Try again in a moment."
              : "It may have been revoked, or the address may be mistyped. Ask whoever sent it for a fresh link."}
          </p>
          <p style={{ marginTop: 8 }}>
            <Link href="/">Start your own log →</Link>
          </p>
        </div>
      </main>
    );
  }

  const who = owner.display_name?.trim();

  return (
    <Dashboard
      apps={apps}
      eyebrow={who ? `${who}'s job search` : "Job search"}
      headline={owner.headline}
    >
      <p className="ro-note">
        You&apos;re viewing a shared log — read only.{" "}
        <Link href="/">Make your own →</Link>
      </p>
    </Dashboard>
  );
}
