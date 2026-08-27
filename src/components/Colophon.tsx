const STACK = [
  "Next.js 15 · App Router",
  "TypeScript",
  "Supabase Postgres",
  "Row Level Security",
  "Supabase Auth",
  "Edge Functions",
  "Tailwind v4",
  "Vercel",
];

export default function Colophon({ repoUrl }: { repoUrl?: string }) {
  return (
    <section className="colophon">
      <h2>About this</h2>
      <p>
        Built by Kyle Foley. It started as one page so my girlfriend would stop
        asking whether I&apos;d applied to anything. It turned out other people
        wanted the same receipt, so now anyone can keep one.
      </p>
      <p>
        Every row belongs to an owner, and isolation is enforced in Postgres
        rather than in the app: Row Level Security restricts each table to the
        signed-in user&apos;s own rows, so the queries carry no user filter at all
        and there is no client-side check to forget or bypass. Public share links
        go through two parameterized, read-only database functions that return
        only the columns a visitor should see, for a 96-bit token, and only while
        its owner leaves sharing on — which is why the app ships no service-role
        key and holds no credential that can read anyone else&apos;s data.
      </p>
      <ul className="stack">
        {STACK.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {repoUrl && (
        <p>
          Source:{" "}
          <a href={repoUrl} target="_blank" rel="noreferrer noopener">
            {repoUrl.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        </p>
      )}
    </section>
  );
}
