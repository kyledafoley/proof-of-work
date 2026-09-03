import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Proof of Work",
  description: "The terms for using Proof of Work.",
};

export default function Terms() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="eyebrow"><Link href="/">Proof of Work</Link></div>
      </div>
      <article className="legal">
        <h1>Terms of service</h1>
        <p className="legal-date">Last updated September 3, 2026</p>

        <h2>The deal</h2>
        <p>
          Proof of Work (imtrying.org) is a free job application tracker run by Kyle Foley.
          By creating an account you agree to these terms. If you don&rsquo;t, don&rsquo;t
          create one.
        </p>

        <h2>Your account</h2>
        <p>
          You need to be at least 16 and give a real email address you control. You are
          responsible for what is logged under your account and for keeping your password to
          yourself. One person, one account.
        </p>

        <h2>Your content</h2>
        <p>
          What you log is yours. By turning sharing on you are choosing to make your
          applications readable by anyone who has your link; you can turn that off or replace
          the link at any time. Don&rsquo;t log anything you don&rsquo;t have the right to
          share, and don&rsquo;t use a shared log to harass, defame or impersonate anyone.
        </p>

        <h2>Gmail</h2>
        <p>
          Connecting Gmail is optional. It grants read-only access that you can revoke at any
          time. What is read and what is stored is set out in the{" "}
          <Link href="/privacy">privacy page</Link>, which is part of these terms.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Don&rsquo;t try to read anyone else&rsquo;s data, probe the service for weaknesses,
          scrape it, overload it, or use it for anything unlawful. Accounts that do will be
          removed.
        </p>

        <h2>No warranty</h2>
        <p>
          This is a small, free service maintained by one person. It is provided as is, with
          no promise that it will be available, accurate or bug-free. The Gmail scan uses
          pattern matching and will sometimes mislabel a message; check before you act on it.
          To the fullest extent the law allows, Proof of Work is not liable for any loss
          arising from your use of it. Export what matters to you.
        </p>

        <h2>Ending things</h2>
        <p>
          You can delete your account at any time from Settings, which removes everything.
          The service may be changed or shut down; if it shuts down, you will get notice and
          a chance to take your data.
        </p>

        <h2>Changes and contact</h2>
        <p>
          If these terms change materially, the date at the top changes. Continuing to use the
          service after that means you accept the new terms. Questions:{" "}
          <a href="mailto:k.t.foley1998@gmail.com">k.t.foley1998@gmail.com</a>. These terms
          are governed by the laws of North Carolina, United States.
        </p>

        <p className="legal-foot">
          <Link href="/privacy">Privacy</Link>
        </p>
      </article>
    </main>
  );
}
