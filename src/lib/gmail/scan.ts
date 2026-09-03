import type { Application } from "@/lib/types";

/**
 * How a message gets matched to an application, and what kind of message it
 * looks like. Pure functions — no I/O — so they can be reasoned about (and
 * tested) without a mailbox.
 */

export type EmailKind = "interview" | "rejection" | "confirmation" | "reply" | "other";

/** Gmail search for one application: anything since the day before it was
 *  sent, not from the user, that mentions the company. Gmail's search covers
 *  the body, so "Acme" in a signature block is enough. The role is the
 *  fallback when the company is blank — weaker, but better than skipping. */
export function queryFor(app: Application): string | null {
  const term = phrase(app.company) ?? phrase(app.role);
  if (!term) return null;
  const since = shiftDays(app.applied_on, -1);
  return `after:${since} -from:me -in:sent -in:chats -category:promotions -category:social ${term}`;
}

/** The "possibly missed" sweep: recent mail that reads like it is about a job
 *  application, whoever it is from. Deliberately narrow — the job boards
 *  themselves are excluded, since a digest of "new jobs for you" is exactly
 *  the noise this list must not fill up with. */
export function sweepQuery(days = 45): string {
  const subjects = [
    "your application", "application received", "application for", "application to",
    "interview", "next steps", "phone screen", "candidate", "position",
  ].map((s) => `"${s}"`).join(" OR ");
  const noise = [
    "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "dice.com",
    "monster.com", "handshake.com", "wellfound.com", "builtin.com",
  ].map((d) => `-from:${d}`).join(" ");
  return `newer_than:${days}d -from:me -in:sent -in:chats -category:promotions -category:social subject:(${subjects}) ${noise}`;
}

/** Quote a name for a Gmail query, dropping suffixes that a sender's domain
 *  or signature usually omits ("Acme, Inc." → "Acme"). Returns null when what
 *  is left is too short to mean anything. */
function phrase(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim()
    .replace(/[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh)\b\.?$/i, "")
    .replace(/["()]/g, "")
    .trim();
  if (s.length < 3) return null;
  // Multi-word names search as a phrase; a very long one is cut to its first
  // few words, which is what a sender's signature will contain anyway.
  s = s.split(/\s+/).slice(0, 4).join(" ");
  return `"${s}"`;
}

function shiftDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** What the message is, from subject + snippet. Order matters: a rejection
 *  that mentions "future interviews" is still a rejection, and an interview
 *  invitation that opens "thank you for your application" is still an
 *  interview. Confirmations are the automatic "we got it" — they are NOT
 *  counted as hearing back, because nobody read anything yet. */
export function classify(subject: string, snippet: string): EmailKind {
  const t = `${subject}\n${snippet}`.toLowerCase().replace(/\s+/g, " ");
  const rejection =
    /\bunfortunately\b|not (been )?selected|other candidates|not (be )?moving forward|no longer (under )?consider|decided to (move|go|proceed) (forward|ahead)? ?with (other|another)|will not be (moving|proceeding)|(position|role) has been filled|we regret|pursue other candidates|not the right fit|not a (match|fit) at this time|won.t be moving forward/;
  const interview =
    /\binterview\b|phone screen|screening call|schedule (a|your|some) (call|time|chat|conversation|meeting)|your availability|are you available|invite you to|would love to (chat|talk|speak|meet)|next round|meet (with )?the team|calendly\.com|book a time/;
  const confirmation =
    /thank(s| you) for (applying|your application|your interest|submitting)|application (was |has been |is )?(received|submitted|complete)|we('ve| have) received your (application|resume|cv)|successfully (submitted|applied)|your application to .* (was|has been) (received|submitted)|confirm(ing|ation of) your application/;
  if (rejection.test(t)) return "rejection";
  if (interview.test(t)) return "interview";
  if (confirmation.test(t)) return "confirmation";
  return "reply";
}

/** Does a message plausibly belong to this application? Gmail's search is
 *  generous (it will match "Acme" inside an unrelated newsletter), so a
 *  second, stricter check runs on what came back: the company has to appear
 *  in the sender, the subject or the snippet. */
export function belongsTo(app: Application, meta: { from: string; subject: string; snippet: string }): boolean {
  const name = (app.company ?? "").trim();
  if (!name) return true; // matched on role; nothing stricter to check
  const key = name.toLowerCase()
    .replace(/[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh)\b\.?$/i, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
  const first = key.split(" ")[0];
  const hay = `${meta.from}\n${meta.subject}\n${meta.snippet}`.toLowerCase();
  const domainish = key.replace(/\s+/g, "");
  return hay.includes(key) || hay.includes(domainish) || (first.length >= 4 && hay.includes(first));
}

/** Senders that are never a company replying to you, whatever they say:
 *  job boards, alert digests, and Google's own account notices (which
 *  mention "amazon.jobs" and the like in passing). */
const NOISE_SENDERS =
  /(^|[@.])(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|dice\.com|monster\.com|handshake\.com|wellfound\.com|builtin\.com|lensa\.com|jobcase\.com|google\.com|accounts\.google\.com|amazonbusiness\.com|business\.amazon\.com)$/i;

/** Words a message about YOUR application contains. A plain "reply" that
 *  has none of them and arrives from a mailing system is a newsletter that
 *  happens to mention the company. */
const JOB_WORDS =
  /\b(applicat|applied|apply|candidate|position|role|resume|cv\b|recruit|hiring|talent|interview|opportunit|career|your profile|job\b|offer)/i;

/** Is this message worth showing at all? Runs after classify(). */
export function isNoise(meta: { from: string; subject: string; snippet: string; bulk: boolean }, kind: EmailKind): boolean {
  const addr = (meta.from.match(/<([^>]+)>/)?.[1] ?? meta.from).trim().toLowerCase();
  const domain = addr.split("@")[1] ?? "";
  if (NOISE_SENDERS.test(domain)) return true;
  if (kind === "reply") {
    const t = `${meta.subject}\n${meta.snippet}`;
    // Bulk mail with nothing about an application in it is marketing.
    if (meta.bulk && !JOB_WORDS.test(t)) return true;
  }
  return false;
}

export const KIND_LABEL: Record<EmailKind, string> = {
  interview: "Interview",
  rejection: "Rejection",
  confirmation: "Auto-confirmation",
  reply: "Reply",
  other: "Other",
};
