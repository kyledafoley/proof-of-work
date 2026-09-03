"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_LABEL, type EmailKind } from "@/lib/gmail/scan";
import { statusMeta, type Application, type Status } from "@/lib/types";

/**
 * "Did I miss anything?" — connect Gmail (read-only), scan it for replies to
 * the applications in the log, and act on what it found.
 *
 * What the browser can see: that Gmail is connected, which address, when it
 * was last scanned, and the matches (headers and a snippet). What it cannot
 * see: the refresh token — that column is not selectable from a client, and
 * only the server routes can decrypt it. Nothing here ever reads a message
 * body; the link opens the real thing in Gmail.
 */

type Connection = { email: string; connected_at: string; last_scan_at: string | null };

type Match = {
  id: string;
  application_id: string | null;
  gmail_thread_id: string;
  from_name: string | null;
  from_address: string;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  kind: EmailKind;
  dismissed: boolean;
};

/** The status a message of this kind argues for. Confirmations argue for
 *  nothing: an auto-reply is not hearing back. */
const SUGGEST: Partial<Record<EmailKind, Status>> = {
  interview: "interview",
  rejection: "rejected",
  reply: "heard",
};

const KIND_PILL: Record<EmailKind, string> = {
  interview: "pill-interview",
  rejection: "pill-rejected",
  confirmation: "pill-applied",
  reply: "pill-heard",
  other: "pill-applied",
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function EmailScanCard({
  supabase,
  apps,
  onAppsChanged,
}: {
  supabase: SupabaseClient;
  apps: Application[];
  onAppsChanged: () => Promise<void> | void;
}) {
  const [conn, setConn] = useState<Connection | null | undefined>(undefined);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("gmail_connections").select("email, connected_at, last_scan_at").maybeSingle(),
      supabase.from("email_matches")
        .select("id, application_id, gmail_thread_id, from_name, from_address, subject, snippet, received_at, kind, dismissed")
        .order("received_at", { ascending: false })
        .limit(400),
    ]);
    setConn((c as Connection | null) ?? null);
    setMatches((m ?? []) as Match[]);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  // The OAuth round trip lands back here with ?gmail=… — say what happened
  // once, then clean the URL so a refresh doesn't say it again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const flag = url.searchParams.get("gmail");
    if (!flag) return;
    const msg: Record<string, string> = {
      connected: "Gmail connected. Run a scan whenever you like.",
      denied: "Google didn't grant access — nothing was connected.",
      state: "That sign-in didn't start here, so it was ignored. Try again.",
      failed: "Google connected but saving the connection failed. Try again.",
      unconfigured: "This deployment has no Google credentials yet, so Gmail can't be connected. (Owner: see the README's Gmail scan section.)",
    };
    setNotice(msg[flag] ?? null);
    url.searchParams.delete("gmail");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
  }, []);

  async function scan() {
    setScanning(true);
    setError(null);
    setNotice(null);
    let total = 0;
    let rounds = 0;
    try {
      // The route stops after a few seconds and says `more`; keep calling
      // until it is done, so a long log scans in rounds instead of timing out.
      for (;;) {
        rounds++;
        setProgress(rounds === 1 ? "Scanning…" : `Still scanning (round ${rounds})…`);
        const res = await fetch("/api/gmail/scan", { method: "POST" });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; found?: number; more?: boolean; error?: string };
        if (res.status === 409 && j.error === "reconnect") {
          setError("Google dropped the connection (this happens weekly while the app is unverified). Connect Gmail again.");
          setConn(null);
          break;
        }
        if (!res.ok) { setError(j.error || "The scan failed."); break; }
        total += j.found ?? 0;
        if (!j.more || rounds >= 12) break;
      }
      await load();
      if (!error) setNotice(total === 0 ? "Nothing new since the last scan." : `${total} new message${total === 1 ? "" : "s"} found.`);
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }

  async function disconnect() {
    setError(null);
    const res = await fetch("/api/gmail/disconnect", { method: "POST" });
    if (!res.ok) { setError("Couldn't disconnect. Try again."); return; }
    setConn(null);
    setNotice("Gmail disconnected. Google no longer has this app on your account.");
  }

  async function dismiss(m: Match, value = true) {
    const { error } = await supabase.from("email_matches").update({ dismissed: value }).eq("id", m.id);
    if (error) { setError(error.message); return; }
    setMatches((ms) => ms.map((x) => (x.id === m.id ? { ...x, dismissed: value } : x)));
  }

  async function setStatus(m: Match, status: Status) {
    if (!m.application_id) return;
    const { error } = await supabase.from("applications").update({ status }).eq("id", m.application_id);
    if (error) { setError(error.message); return; }
    await dismiss(m);
    await onAppsChanged();
  }

  async function clearAll() {
    const { error } = await supabase.from("email_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { setError(error.message); return; }
    setMatches([]);
  }

  const byApp = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const visible = matches.filter((m) => showDismissed || !m.dismissed);
  const grouped = useMemo(() => {
    const g = new Map<string, Match[]>();
    for (const m of visible) {
      if (!m.application_id || !byApp.has(m.application_id)) continue;
      (g.get(m.application_id) ?? g.set(m.application_id, []).get(m.application_id)!).push(m);
    }
    // Newest activity first.
    return [...g.entries()].sort((a, b) => b[1][0].received_at.localeCompare(a[1][0].received_at));
  }, [visible, byApp]);
  const missed = visible.filter((m) => !m.application_id || !byApp.has(m.application_id));
  const dismissedCount = matches.filter((m) => m.dismissed).length;

  if (conn === undefined) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Inbox scan</h2>
        <span className="panel-note">{conn ? conn.email : "not connected"}</span>
      </div>

      {!conn ? (
        <>
          <p className="form-note" style={{ marginBottom: 12 }}>
            Connect Gmail and this will look for replies to every application in your log
            &mdash; the ones that landed in a folder you don&rsquo;t check, the rejection that
            read like a newsletter, the interview request from three weeks ago. Read-only:
            it can&rsquo;t send, delete or change anything, and it never stores a message body.
          </p>
          <div className="share-actions">
            <a className="btn" href="/api/gmail/connect">Connect Gmail</a>
          </div>
        </>
      ) : (
        <>
          <p className="form-note" style={{ marginBottom: 12 }}>
            {conn.last_scan_at
              ? `Last scanned ${new Date(conn.last_scan_at).toLocaleString()}.`
              : "Connected. Not scanned yet."}{" "}
            A scan checks each application for mail mentioning the company since you applied,
            then sweeps for job-shaped mail that matches nothing you logged.
          </p>
          <div className="share-actions">
            <button type="button" className="btn btn-small" onClick={scan} disabled={scanning}>
              {progress ?? "Scan inbox"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={disconnect} disabled={scanning}>
              Disconnect
            </button>
            {matches.length > 0 && (
              <button type="button" className="btn btn-ghost btn-small" onClick={clearAll} disabled={scanning}>
                Clear results
              </button>
            )}
          </div>
        </>
      )}

      {notice && <p className="form-note" style={{ marginTop: 10 }}>{notice}</p>}
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}

      {grouped.length > 0 && (
        <div className="scan-groups">
          {grouped.map(([appId, ms]) => {
            const app = byApp.get(appId)!;
            const meta = statusMeta(app.status);
            return (
              <div key={appId} className="scan-group">
                <div className="scan-group-head">
                  <span className="scan-group-title">
                    <strong>{app.company ?? "—"}</strong> · {app.role}
                  </span>
                  <span className={`pill pill-${meta.id}`}><span className="dot" />{meta.label}</span>
                </div>
                {ms.map((m) => <MatchRow key={m.id} m={m} app={app} onDismiss={dismiss} onStatus={setStatus} />)}
              </div>
            );
          })}
        </div>
      )}

      {missed.length > 0 && (
        <div className="scan-groups">
          <div className="scan-group">
            <div className="scan-group-head">
              <span className="scan-group-title"><strong>Possibly missed</strong> · matched nothing in your log</span>
            </div>
            {missed.map((m) => <MatchRow key={m.id} m={m} app={null} onDismiss={dismiss} onStatus={setStatus} />)}
          </div>
        </div>
      )}

      {conn && matches.length > 0 && grouped.length === 0 && missed.length === 0 && (
        <p className="form-note" style={{ marginTop: 12 }}>Everything found so far has been handled.</p>
      )}

      {dismissedCount > 0 && (
        <p className="form-note" style={{ marginTop: 12 }}>
          <button type="button" className="linkish" onClick={() => setShowDismissed((s) => !s)}>
            {showDismissed ? "Hide" : "Show"} {dismissedCount} handled
          </button>
        </p>
      )}
    </section>
  );
}

function MatchRow({
  m, app, onDismiss, onStatus,
}: {
  m: Match;
  app: Application | null;
  onDismiss: (m: Match, value?: boolean) => Promise<void>;
  onStatus: (m: Match, s: Status) => Promise<void>;
}) {
  const suggest = app ? SUGGEST[m.kind] : undefined;
  const already = suggest && app && app.status === suggest;
  const gmailHref = `https://mail.google.com/mail/#all/${encodeURIComponent(m.gmail_thread_id)}`;
  return (
    <div className={`scan-row${m.dismissed ? " scan-row-done" : ""}`}>
      <div className="scan-row-main">
        <span className={`pill ${KIND_PILL[m.kind]}`}><span className="dot" />{KIND_LABEL[m.kind]}</span>
        <span className="scan-when">{when(m.received_at)}</span>
        <span className="scan-from" title={m.from_address}>{m.from_name ?? m.from_address}</span>
      </div>
      <a className="scan-subject" href={gmailHref} target="_blank" rel="noopener noreferrer">
        {m.subject || "(no subject)"}
      </a>
      {m.snippet && <p className="scan-snippet">{m.snippet}</p>}
      <div className="scan-actions">
        {suggest && !already && !m.dismissed && (
          <button type="button" className="btn btn-small" onClick={() => onStatus(m, suggest)}>
            Mark {statusMeta(suggest).label.toLowerCase()}
          </button>
        )}
        {app && !m.dismissed && (
          <span className="scan-alt">
            {(["heard", "interview", "rejected"] as Status[])
              .filter((s) => s !== suggest && s !== app.status)
              .map((s) => (
                <button key={s} type="button" className="linkish" onClick={() => onStatus(m, s)}>
                  {statusMeta(s).label.toLowerCase()}
                </button>
              ))}
          </span>
        )}
        <button type="button" className="linkish" onClick={() => onDismiss(m, !m.dismissed)}>
          {m.dismissed ? "Restore" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
