import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/gmail/crypto";
import {
  ReconnectNeeded, accessTokenFromRefresh, getMessageMeta, listMessageIds, parseFrom,
} from "@/lib/gmail/google";
import { belongsTo, classify, isNoise, queryFor, sweepQuery } from "@/lib/gmail/scan";
import type { Application } from "@/lib/types";

// The scan. Runs as the signed-in user: the applications it reads and the
// matches it writes both go through RLS, and the refresh token comes from a
// function that only returns the caller's own. There is no way to point this
// at someone else's mailbox or someone else's log.
//
// Per application: one Gmail search since the day before it was sent for
// mail mentioning the company, a stricter re-check on what comes back, then
// headers-only fetches for anything new. Then one sweep for job-shaped mail
// that matched nothing, which lands in the "possibly missed" pile.
//
// Budgeted: the route stops fetching after ~8 seconds and says `more: true`
// so the panel can call again; a first scan of a long log takes a few rounds
// rather than timing out.

export const runtime = "nodejs";
export const maxDuration = 30;

const TIME_BUDGET_MS = 8000;
const PER_APP_MAX = 12;
const SWEEP_MAX = 30;

type Found = {
  owner_id: string;
  application_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string;
  from_name: string | null;
  from_address: string;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  kind: ReturnType<typeof classify>;
};

/** How far back an incremental scan reaches behind the last scan. Mail can
 *  arrive with a timestamp earlier than when it landed, and the duplicate
 *  check on message id makes overlap free. */
const OVERLAP_S = 24 * 3600;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sinceLast?: boolean };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: enc, error: tokErr } = await supabase.rpc("gmail_refresh_token");
  if (tokErr) return NextResponse.json({ error: tokErr.message }, { status: 500 });
  if (typeof enc !== "string" || !enc) return NextResponse.json({ error: "Gmail is not connected" }, { status: 409 });

  let accessToken: string;
  try {
    accessToken = await accessTokenFromRefresh(decryptToken(enc));
  } catch (e) {
    if (e instanceof ReconnectNeeded) return NextResponse.json({ error: "reconnect" }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Google error" }, { status: 502 });
  }

  const [{ data: appsRaw }, { data: known }, { data: conn }] = await Promise.all([
    supabase.from("applications")
      .select("id, role, company, description, location, salary, applied_on, status")
      .order("applied_on", { ascending: false }),
    supabase.from("email_matches").select("gmail_message_id"),
    supabase.from("gmail_connections").select("last_scan_at").maybeSingle(),
  ]);
  const apps = (appsRaw ?? []) as Application[];
  const seen = new Set((known ?? []).map((k: { gmail_message_id: string }) => k.gmail_message_id));
  // Incremental by default once a full scan has completed: only mail since
  // then (less a day of overlap). Unchecked in the panel, or before any scan
  // has finished, it is the whole window again.
  const lastScan = conn?.last_scan_at ? Math.floor(new Date(conn.last_scan_at as string).getTime() / 1000) : null;
  const sinceEpoch = body.sinceLast !== false && lastScan ? lastScan - OVERLAP_S : undefined;

  const started = Date.now();
  const outOfTime = () => Date.now() - started > TIME_BUDGET_MS;
  const found: Found[] = [];
  let more = false;
  let checked = 0;

  try {
    for (const app of apps) {
      if (outOfTime()) { more = true; break; }
      const q = queryFor(app, sinceEpoch);
      if (!q) continue;
      checked++;
      const ids = await listMessageIds(accessToken, q, PER_APP_MAX);
      for (const id of ids) {
        if (seen.has(id)) continue;
        if (outOfTime()) { more = true; break; }
        const meta = await getMessageMeta(accessToken, id);
        if (!belongsTo(app, meta)) continue;
        const kind = classify(meta.subject, meta.snippet);
        // Remembered as seen either way, so a newsletter is not re-fetched
        // on every scan — but only real matches are stored.
        seen.add(id);
        if (isNoise(meta, kind)) continue;
        const from = parseFrom(meta.from);
        found.push({
          owner_id: user.id,
          application_id: app.id,
          gmail_message_id: meta.id,
          gmail_thread_id: meta.threadId,
          from_name: from.name,
          from_address: from.address,
          subject: meta.subject || null,
          snippet: meta.snippet || null,
          received_at: meta.date.toISOString(),
          kind,
        });
      }
    }

    // The sweep only runs once the per-application pass has finished, so a
    // message about a logged company is attributed before it can be filed
    // as "missed".
    if (!more) {
      const ids = await listMessageIds(accessToken, sweepQuery(45, sinceEpoch), SWEEP_MAX);
      for (const id of ids) {
        if (seen.has(id)) continue;
        if (outOfTime()) { more = true; break; }
        const meta = await getMessageMeta(accessToken, id);
        const kind = classify(meta.subject, meta.snippet);
        seen.add(id);
        if (isNoise(meta, kind)) continue;
        const from = parseFrom(meta.from);
        found.push({
          owner_id: user.id,
          application_id: null,
          gmail_message_id: meta.id,
          gmail_thread_id: meta.threadId,
          from_name: from.name,
          from_address: from.address,
          subject: meta.subject || null,
          snippet: meta.snippet || null,
          received_at: meta.date.toISOString(),
          kind,
        });
      }
    }
  } catch (e) {
    if (e instanceof ReconnectNeeded) return NextResponse.json({ error: "reconnect" }, { status: 409 });
    // Keep what was found before the error; report the error alongside.
    const msg = e instanceof Error ? e.message : "Gmail error";
    if (found.length === 0) return NextResponse.json({ error: msg }, { status: 502 });
    more = true;
    console.error("gmail scan (partial):", msg);
  }

  if (found.length) {
    const { error } = await supabase
      .from("email_matches")
      .upsert(found, { onConflict: "owner_id,gmail_message_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!more) {
    await supabase.rpc("gmail_mark_scanned");
  }

  return NextResponse.json({ ok: true, found: found.length, checked, more, incremental: !!sinceEpoch });
}
