# Proof of Work

A public, running log of every job I've applied to — role, description, location,
salary, date, and how long each one has stayed quiet.

The dashboard at `/` is world-readable. Entries are added at `/admin`, which is
gated by Supabase Auth and, underneath that, by Row Level Security: the anon key
shipped to the browser can `SELECT` and nothing else. Writes require a session
whose user id appears in `public.app_admins`, a table nobody can enumerate or
add themselves to. Deleting the front end would not change that.

## Stack

| Layer    | Choice |
| -------- | ------ |
| Framework | Next.js 15, App Router, React 19, TypeScript |
| Styling  | Tailwind v4, design tokens in `globals.css`, light + dark |
| Data     | Supabase Postgres, RLS on every path |
| Auth     | Supabase Auth (email + password), cookie sessions via `@supabase/ssr` |
| Hosting  | Vercel |

`/` is statically rendered and revalidated every 30 seconds, so visitors are
served from cache. `/admin` is client-rendered against the same RLS-protected
API.

## Setup

### 1. Database

Create a Supabase project, open the SQL editor, and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
creates:

- `public.applications` — the log, with a `status` enum and length checks
- `public.app_admins` — the writers allowlist. One policy: a signed-in user may
  read **their own row only**. No write policy exists, so nobody can enumerate
  the writers or add themselves.
- five policies on top of that: world-readable `SELECT`, and
  `INSERT`/`UPDATE`/`DELETE` gated on an `EXISTS` against the allowlist
- a trigger that maintains `updated_at` server-side

There is deliberately no `SECURITY DEFINER` function and no RPC — the self-read
policy on `app_admins` is all the membership check needs, which keeps the API
surface to two tables. `supabase --linter` reports zero security findings.

### 2. Your account

In **Authentication → Users**, add a user with your email and a password. Copy
its UID, then in the SQL editor:

```sql
insert into public.app_admins (user_id) values ('<your-user-uid>');
```

Then in **Authentication → Sign In / Providers**, turn **"Allow new users to
sign up"** off. Without that, anyone could create an account — they still
couldn't write anything, but there is no reason to let them try.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in the project URL and anon key from
**Project Settings → API**:

```bash
cp .env.example .env.local
npm install
npm run dev
```

### 4. Deploy

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new), and
add the same three variables under **Settings → Environment Variables**:

| Variable | Value |
| -------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key |
| `NEXT_PUBLIC_REPO_URL` | optional; linked from the page footer |

Both Supabase values are meant to be public — RLS is the boundary, not the key.

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Notes

- Dates are stored as calendar `date` values and parsed component-wise
  (`src/lib/derive.ts`) so a timezone west of UTC never shifts an application by
  a day.
- "Gone quiet" is derived, not stored: an application counts as quiet if it is
  marked `ghosted`, or still `applied` after 21 days.
- Fonts are self-hosted at build time by `next/font`, so no request leaves the
  page for typography.
