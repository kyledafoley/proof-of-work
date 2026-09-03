import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Proof of Work",
  description: "What Proof of Work stores, what it does with Gmail access, and how to remove all of it.",
};

// Plain English, and specific, because the Gmail scan means this page is
// also a promise to Google: use of data from Google APIs follows the Google
// API Services User Data Policy, including its Limited Use requirements.
export default function Privacy() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="eyebrow"><Link href="/">Proof of Work</Link></div>
      </div>
      <article className="legal">
        <h1>Privacy</h1>
        <p className="legal-date">Last updated September 3, 2026</p>

        <h2>What this is</h2>
        <p>
          Proof of Work (imtrying.org) is a job application tracker run by Kyle Foley in
          Charlotte, North Carolina. You log applications; your log is private until you
          share its link. This page says what is stored, what the optional Gmail scan does,
          and how to delete everything.
        </p>

        <h2>What is stored</h2>
        <p>
          Your account email and a password hash (held by Supabase Auth). The applications
          you log: role, company, description, location, pay, date and status. A display
          name and headline if you add them. A share token for your public link, and whether
          sharing is on. Nothing is collected in the background; there is no analytics or
          advertising tracking on the site.
        </p>

        <h2>The Gmail scan</h2>
        <p>
          If you connect Gmail, Proof of Work asks for one permission: read-only access to
          your mail (<code>gmail.readonly</code>). It cannot send, delete, label or change
          anything. You can disconnect at any time from the app, which revokes the permission
          with Google and deletes our copy of the token, or from your Google Account&rsquo;s
          third-party access page.
        </p>
        <p>
          What the scan does: for each application in your log it searches your mailbox for
          messages that mention the company since the day you applied, plus a narrow search
          for recent mail that looks like it is about a job application. For each match it
          stores the message ID, thread ID, sender name and address, subject, the short
          preview snippet Google provides, the date, and a label (interview, rejection,
          confirmation, reply). It never stores a message body. Matches are shown only to
          you, are never part of your shared log, and are deleted when you clear them or
          delete your account.
        </p>
        <p>
          The token that grants access is stored encrypted (AES-256-GCM) under a key that
          lives only in the application&rsquo;s server environment, in a database column that
          the app&rsquo;s own client cannot read.
        </p>
        <p>
          Proof of Work&rsquo;s use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer noopener">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Gmail data is used only to show you
          replies to your own applications. It is not used for advertising, is not sold, is
          not shared with anyone, and is not used to train models.
        </p>

        <h2>Who can see what</h2>
        <p>
          Your log is visible only to you unless you turn sharing on, in which case anyone
          with your link can read your applications (not your email address, not your Gmail
          matches, not anything else). Share pages are marked <code>noindex</code>. You can
          turn sharing off or replace the link at any time.
        </p>

        <h2>Where it lives</h2>
        <p>
          Data is stored with Supabase (Postgres, hosted in the United States) and the site
          runs on Vercel. Access to each row is enforced in the database with row level
          security: a signed-in user can reach only their own rows.
        </p>

        <h2>Deleting everything</h2>
        <p>
          Settings &rarr; Delete account removes your account, your applications, your Gmail
          connection and every match, immediately and permanently. Or email{" "}
          <a href="mailto:k.t.foley1998@gmail.com">k.t.foley1998@gmail.com</a> and it will be
          done by hand.
        </p>

        <h2>Changes</h2>
        <p>
          If this page changes in a way that matters, the date at the top changes with it.
          Questions: <a href="mailto:k.t.foley1998@gmail.com">k.t.foley1998@gmail.com</a>.
        </p>

        <p className="legal-foot">
          <Link href="/terms">Terms of service</Link>
        </p>
      </article>
    </main>
  );
}
