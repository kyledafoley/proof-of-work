"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export default function ShareCard({
  supabase,
  profile,
  onProfileChange,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  onProfileChange: (next: Partial<Profile>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url =
    typeof window === "undefined"
      ? `/s/${profile.share_token}`
      : `${window.location.origin}/s/${profile.share_token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't reach the clipboard — select the link and copy it.");
    }
  }

  async function toggleShared() {
    setBusy(true);
    setError(null);
    const next = !profile.is_shared;
    const { error } = await supabase
      .from("profiles")
      .update({ is_shared: next })
      .eq("id", profile.id);
    if (error) setError(error.message);
    else onProfileChange({ is_shared: next });
    setBusy(false);
  }

  async function rotate() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("rotate_share_token");
    if (error) setError(error.message);
    else if (typeof data === "string") {
      onProfileChange({ share_token: data });
      setArmed(false);
      setCopied(false);
    }
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Your share link</h2>
        <span className="panel-note">
          {profile.is_shared ? "active" : "turned off"}
        </span>
      </div>

      <p className="form-note" style={{ marginBottom: 12 }}>
        Anyone with this link can read your log. Nobody can find it without it,
        and it never appears in search results.
      </p>

      <div className="share-row">
        <code className="share-url">{url}</code>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={copy}
          disabled={!profile.is_shared}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="share-actions">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={toggleShared}
          disabled={busy}
        >
          {profile.is_shared ? "Turn sharing off" : "Turn sharing on"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={rotate}
          disabled={busy}
        >
          {armed ? "Tap again — old link dies" : "Generate a new link"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
