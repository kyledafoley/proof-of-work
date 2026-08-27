# Proof of Work

A job search is invisible work. You send applications into a void, hear nothing
back, and have nothing to point at when someone asks how it's going. This makes
the void countable — and gives you one link to send instead of an answer.

Anyone can sign up. Each person's log is private to them until they share its
link.

## Security model

The interesting part, and the reason the code has no permission checks in it.

**Isolation lives in Postgres, not the app.** Every `applications` row carries an
`owner_id`, and RLS policies restrict all four verbs to `owner_id = auth.uid()`.
The client queries carry no user filter at all — `select * from applications`
returns your rows and only yours, because the database will not return anything
else. There is no client-side check to forget, and editing the JavaScript in a
browser gains an attacker nothing.

**Logged-out visitors have no table access whatsoever.** `anon` holds no policy
on `applications` or `profiles`. The public share page reaches data through
exactly two functions, `shared_owner(token)` and `shared_applications(token)`,
which:

- take the token as a parameter and match it exactly — no pattern, no
  interpolation, no way to widen the result set;
- filter on `is_shared`, so revoking a link takes effect on the next request;
- return a fixed column list that omits `owner_id`, timestamps, and everything
  else internal.

Tokens are 12 random bytes rendered URL-safe — ~96 bits, unguessable, and
rotatable from the app. `robots` is set to `noindex` on share pages.

**No service-role key is deployed with the web app.** The only place one exists
is the `delete-account` edge function, which never accepts a user id — it
derives the caller's identity from their own access token, so the most a request
can do is delete its sender.

Five `security definer` linter warnings are expected and intentional: the two
share functions (callable by `anon`, which is the whole point) and
`rotate_share_token` (signed-in only). Every other function has been revoked
from `anon` and `authenticated` in `0003`.

## Stack

| Layer | Choice |
| ----- | ------ |
| Framework | Next.js 15, App Router, React 19, TypeScript |
| Styling | Tailwind v4, design tokens in `globals.css`, light + dark |
| Data | Supabase Postgres, RLS on every table and every verb |
| Auth | Supabase Auth (email + password), cookie sessions via `@supabase/ssr` |
| Serverless | Supabase Edge Function for account deletion |
| Hosting | Vercel |

## Routes

| Route | What it is |
| ----- | ---------- |
| `/` | Landing page, plus a featured live log if `NEXT_PUBLIC_FEATURED_SHARE_TOKEN` is set |
| `/app` | Your own log — add, edit, delete, share settings, account settings |
| `/s/[token]` | Someone's shared log, read only, `noindex` |
| `/reset` | Password reset landing, reached from the email link |
| `/admin` | Redirects to `/app` (the route name from the single-user era) |

## Setup

### 1. Database

Run the migrations in `supabase/migrations/` in order against a fresh Supabase
project. `0001` creates the log, `0002` makes it multi-tenant, `0003` tightens
function grants.

### 2. Edge function

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform — nothing to configure.

### 3. Auth settings

In the Supabase dashboard:

- **Sign In / Providers** → leave signups **on** (this is a multi-user app now)
- **Passwords** → enable leaked-password protection
- **SMTP** → **required before real users sign up.** Supabase's built-in sender
  is rate-limited to a couple of emails an hour and is not for production.
  Confirmations and password resets will silently fail to arrive without a real
  provider (Resend, Postmark, SES) configured under Project Settings → Auth →
  SMTP.
- **URL Configuration** → add your production URL to the redirect allowlist, or
  confirmation and reset links will bounce back to localhost.

### 4. Environment

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

### 5. Deploy

Push to GitHub, import at [vercel.com/new](https://vercel.com/new), and set the
same variables under Settings → Environment Variables.

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
- "Gone quiet" is derived, not stored: quiet means `ghosted`, or still `applied`
  after 21 days.
- A profile row is created by a trigger on `auth.users`, so a half-registered
  account cannot exist.
- Fonts are self-hosted at build time by `next/font`.

## Not built yet

- Rate limiting or captcha on signup. Worth adding before this is linked
  anywhere public — Supabase supports hCaptcha and Turnstile natively.
- Any abuse reporting path for shared content.
- Export (CSV / JSON) of your own log.
