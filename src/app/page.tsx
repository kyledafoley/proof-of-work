import Link from "next/link";
import Colophon from "@/components/Colophon";
import StatTiles from "@/components/StatTiles";
import ThemeToggle from "@/components/ThemeToggle";
import { computeStats } from "@/lib/derive";
import { getSharedLog } from "@/lib/supabase/public";

export const revalidate = 60;

const STEPS = [
  {
    title: "Log it when you apply",
    body: "Role, company, location, pay, and the date. Thirty seconds, right after you hit submit.",
  },
  {
    title: "Send one link",
    body: "You get a private URL. Nobody finds it without it, and you can switch it off or reissue it whenever.",
  },
  {
    title: "Let the numbers argue",
    body: "Applications sent, replies back, and how long each one has sat in silence. Counted, not claimed.",
  },
];

export default async function LandingPage() {
  const featuredToken = process.env.NEXT_PUBLIC_FEATURED_SHARE_TOKEN;
  const featured = featuredToken ? await getSharedLog(featuredToken) : null;
  const featuredStats =
    featured?.found && featured.apps.length
      ? computeStats(featured.apps)
      : null;

  return (
    <main className="page">
      <div className="topbar">
        <div className="eyebrow">
          <span>Proof of Work</span>
        </div>
        <ThemeToggle />
      </div>

      <header className="masthead">
        <h1 className="landing-h1">
          Proof that you&apos;re
          <br />
          actually applying.
        </h1>
        <div className="hero-rule" />
        <p className="landing-sub">
          A job search is invisible work. You send applications into a void, hear
          nothing back, and have nothing to point at when someone asks how it&apos;s
          going. This makes the void countable — and gives you one link to send
          instead of an answer.
        </p>
        <div className="cta-row">
          <Link className="btn" href="/app?mode=signup">
            Start your log
          </Link>
          <Link className="btn btn-ghost" href="/app">
            Sign in
          </Link>
        </div>
        <p className="fine-print">
          Free. Your log is private until you share its link.
        </p>
      </header>

      <section className="steps">
        {STEPS.map((step, i) => (
          <div className="step" key={step.title}>
            <span className="step-n">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </div>
        ))}
      </section>

      {featuredStats && featured?.found && (
        <section>
          <div className="panel-head" style={{ padding: "0 2px" }}>
            <h2 className="panel-title">A live one</h2>
            <span className="panel-note">updated as it happens</span>
          </div>
          <p className="form-note" style={{ marginBottom: 12 }}>
            {featured.owner.display_name
              ? `${featured.owner.display_name}'s real log, shared publicly as an example.`
              : "A real log, shared publicly as an example."}
          </p>
          <StatTiles stats={featuredStats} />
          <p style={{ marginTop: 12 }}>
            <Link href={`/s/${featuredToken}`}>See the whole thing →</Link>
          </p>
        </section>
      )}

      <Colophon repoUrl={process.env.NEXT_PUBLIC_REPO_URL} />
    </main>
  );
}
