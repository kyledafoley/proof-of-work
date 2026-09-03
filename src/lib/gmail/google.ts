/**
 * The thin Google layer: OAuth URLs, token exchange, and the two Gmail calls
 * the scan needs. Plain `fetch` against the REST API — the googleapis SDK is
 * 30 MB for three endpoints.
 *
 * Scope is `gmail.readonly` and nothing else. The app never sends, labels,
 * deletes or modifies mail, and asks for no permission that would let it.
 */

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { clientId, clientSecret };
}

/** Where Google sends the user back. Fixed by NEXT_PUBLIC_SITE_URL in
 *  production so it matches the redirect URI registered in the Google console
 *  exactly; falls back to the request origin for local development. */
export function redirectUri(requestOrigin: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, "");
  return `${base}/api/gmail/callback`;
}

export function authUrl(opts: { redirectUri: string; state: string; loginHint?: string }): string {
  const { clientId } = oauthConfig();
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: SCOPE,
    // `offline` + `consent` is what makes Google hand back a refresh token
    // (it only does so on a consenting grant, not on a silent re-auth).
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: opts.state,
  });
  if (opts.loginHint) q.set("login_hint", opts.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCode(code: string, redirect: string): Promise<{ accessToken: string; refreshToken: string }> {
  const { clientId, clientSecret } = oauthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirect, grant_type: "authorization_code",
    }),
  });
  const j = (await res.json()) as TokenResponse;
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.error || "Token exchange failed");
  if (!j.refresh_token) throw new Error("Google did not return a refresh token — revoke the app at myaccount.google.com/permissions and connect again");
  if (!(j.scope || "").includes("gmail.readonly")) throw new Error("The Gmail read-only permission was not granted");
  return { accessToken: j.access_token, refreshToken: j.refresh_token };
}

/** Trade the stored refresh token for a short-lived access token. Throws
 *  `ReconnectNeeded` when Google says the grant is dead (revoked, expired
 *  under a testing-mode app's 7-day rule, password changed). */
export class ReconnectNeeded extends Error {}

export async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = oauthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json()) as TokenResponse;
  if (!res.ok || !j.access_token) {
    if (j.error === "invalid_grant") throw new ReconnectNeeded("Google no longer accepts this connection");
    throw new Error(j.error_description || j.error || "Could not refresh the Google token");
  }
  return j.access_token;
}

export async function revokeToken(token: string): Promise<void> {
  // Best effort: a failed revoke still ends with our copy deleted.
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new ReconnectNeeded("Gmail rejected the token");
  if (!res.ok) throw new Error(`Gmail ${path.split("?")[0]}: ${res.status}`);
  return (await res.json()) as T;
}

export async function gmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  return gmailGet(accessToken, "profile");
}

export async function listMessageIds(accessToken: string, q: string, max = 20): Promise<string[]> {
  const j = await gmailGet<{ messages?: { id: string }[] }>(
    accessToken, `messages?q=${encodeURIComponent(q)}&maxResults=${max}`,
  );
  return (j.messages ?? []).map((m) => m.id);
}

export type MessageMeta = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: Date;
  snippet: string;
  /** Sent by a mailing system: List-Unsubscribe or Precedence: bulk/list.
   *  Marketing and job alerts carry these; a recruiter writing to you does
   *  not. ATS confirmations sometimes do, which is why it is a signal, not a
   *  verdict — see scan.ts. */
  bulk: boolean;
};

/** Gmail's snippet is HTML-escaped ("you&#39;d"). Undo the handful of
 *  entities that actually occur; anything else stays as it came. */
function unescapeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/** Headers and the snippet only — `format=metadata` never returns the body,
 *  so a body cannot end up in a log line, a cache or our database by accident. */
export async function getMessageMeta(accessToken: string, id: string): Promise<MessageMeta> {
  const j = await gmailGet<{
    id: string; threadId: string; snippet?: string; internalDate?: string;
    payload?: { headers?: { name: string; value: string }[] };
  }>(accessToken, `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence`);
  const h = (name: string) => j.payload?.headers?.find((x) => x.name.toLowerCase() === name)?.value ?? "";
  const precedence = h("precedence").toLowerCase();
  return {
    id: j.id,
    threadId: j.threadId,
    from: h("from"),
    subject: h("subject"),
    date: j.internalDate ? new Date(Number(j.internalDate)) : new Date(h("date") || Date.now()),
    snippet: unescapeHtml(j.snippet ?? "").slice(0, 300),
    bulk: !!h("list-unsubscribe") || precedence === "bulk" || precedence === "list",
  };
}

/** "Jane Doe <jane@acme.com>" → { name: "Jane Doe", address: "jane@acme.com" } */
export function parseFrom(from: string): { name: string | null; address: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, address: m[2].trim().toLowerCase() };
  return { name: null, address: from.trim().toLowerCase() };
}
