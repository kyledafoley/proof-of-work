const STACK = [
  "Next.js 15 · App Router",
  "TypeScript",
  "Supabase Postgres",
  "Row Level Security",
  "Supabase Auth",
  "Tailwind v4",
  "Vercel",
];

export default function Colophon({ repoUrl }: { repoUrl?: string }) {
  return (
    <section className="colophon">
      <h2>About this page</h2>
      <p>
        A job search is mostly invisible work — you send applications into a void
        and have nothing to point at. So I made the void countable. Every row
        here is a real application, logged as I send it, with a running count of
        how long each one has stayed quiet.
      </p>
      <p>
        The page is server-rendered from a Postgres table. Row Level Security
        makes it world-readable and writable only by an account on an allowlist,
        so the API key in this page can read and nothing else — the write rules
        live in the database, not in the client, and hold no matter what anyone
        sends at them.
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
