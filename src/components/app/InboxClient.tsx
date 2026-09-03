"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import EmailScanCard from "./EmailScanCard";
import { createClient } from "@/lib/supabase/client";

/** /app/inbox — the scan's results at full width. Signed-in only; a visitor
 *  without a session is sent to the log page, which shows the sign-in form. */
export default function InboxClient() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session === null) window.location.replace("/app");
  }, [session]);

  if (!session) return null;

  return (
    <main className="page">
      <div className="topbar">
        <div className="eyebrow">
          <Link href="/app">&larr; Your log</Link>
        </div>
        <ThemeToggle />
      </div>
      <header className="masthead" style={{ marginBottom: 18 }}>
        <h1 className="landing-h1" style={{ fontSize: 34 }}>Inbox scan</h1>
        <p className="landing-sub" style={{ marginTop: 8 }}>
          Replies to the applications in your log, found in your Gmail. Auto-confirmations
          don&rsquo;t count as hearing back; everything else is a suggestion, not a verdict
          &mdash; open the thread before you mark anything.
        </p>
      </header>
      <div className="inbox-page">
        <EmailScanCard supabase={supabase} mode="full" />
      </div>
    </main>
  );
}
