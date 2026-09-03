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

**The Gmail scan holds one real secret, and holds it carefully.** Connecting
Gmail stores a Google refresh token (scope `gmail.readonly`, nothing else).
It is encrypted with AES-256-GCM under a key that lives only in the web app's
environment (`GMAIL_TOKEN_KEY`), and the ciphertext column is excluded from
the table grant — `select *` from a client fails. The only read path is
`gmail_refresh_token()`, a definer function that returns the caller's own row,
and the only write path is `gmail_connect()`, its mirror image.
So the browser can see that Gmail is connected and to which address; the
server routes can decrypt the signed-in user's token and nobody else's; and a
dump of the table is useless without the environment. Scans store headers, a
snippet and a classification per message — never a body — and none of it is
reachable through the share functions.

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
| `/privacy`, `/terms` | Privacy and terms — the Gmail scan makes the privacy page a promise to Google as well |
| `/api/gmail/connect` | Starts the Google OAuth consent flow for the signed-in user |
| `/api/gmail/callback` | Google returns here; stores the encrypted refresh token |
| `/api/gmail/scan` | Scans the connected mailbox for replies to logged applications |
| `/api/gmail/disconnect` | Revokes the Google grant and deletes the token |

## Setup

### 1. Database

Run the migrations in `supabase/migrations/` in order against a fresh Supabase
project. `0001` creates the log, `0002` makes it multi-tenant, `0003` tightens
function grants, `0004` adds the Gmail scan tables, `0005` moves the token
write path into a definer function.

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

### 5. Gmail scan (optional)

The inbox scan needs a Google Cloud project with the Gmail API enabled and an
OAuth client of type **Web application**:

1. Google Cloud console → APIs & Services → Enable **Gmail API**.
2. OAuth consent screen → External. Add the `gmail.readonly` scope. Leave the
   app in **Testing** and add each Gmail address that will connect as a test
   user (up to 100). Publishing with a restricted scope requires Google's
   verification and a paid security assessment; testing mode needs neither.
   The cost: Google expires refresh tokens for testing-mode apps after seven
   days, so the panel will ask to reconnect about weekly.
3. Credentials → Create OAuth client ID → Web application. Authorized redirect
   URIs: `https://<your domain>/api/gmail/callback` and
   `http://localhost:3000/api/gmail/callback`.
4. Environment:

```bash
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
GMAIL_TOKEN_KEY=$(openssl rand -base64 32)   # 32 bytes; rotating it invalidates stored tokens
NEXT_PUBLIC_SITE_URL=https://imtrying.org    # must match the redirect URI exactly
```

Run `supabase/migrations/0004_gmail_scan.sql` and `0005_gmail_connect_fn.sql`
against the database. Without
the three Google variables the panel still renders; connecting just fails.

### 6. Deploy

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
- "Log it" from a possibly-missed message, prefilled with the sender's company.
- Google OAuth verification, if the scan ever needs more than 100 test users.
