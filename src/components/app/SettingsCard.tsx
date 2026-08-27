"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export default function SettingsCard({
  supabase,
  profile,
  email,
  onProfileChange,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  email: string | undefined;
  onProfileChange: (next: Partial<Profile>) => void;
}) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const patch = {
      display_name: name.trim() || null,
      headline: headline.trim() || null,
    };
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profile.id);
    if (error) setError(error.message);
    else {
      onProfileChange(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
  }

  async function deleteAccount() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setDeleting(true);
    setError(null);
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      setError(
        "Couldn't delete the account. Nothing was removed — try again, or email me.",
      );
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Settings</h2>
        <span className="panel-note">{email}</span>
      </div>

      <div className="settings-grid">
        <div className="field">
          <label htmlFor="s-name">Display name</label>
          <input
            id="s-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kyle"
          />
        </div>
        <div className="field">
          <label htmlFor="s-headline">Headline on your shared page</label>
          <input
            id="s-headline"
            value={headline}
            maxLength={140}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Yes, I am actually applying."
          />
        </div>
      </div>

      <div className="share-actions" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="danger">
        <div>
          <strong>Delete account</strong>
          <p className="form-note">
            Removes your login and every application you&apos;ve logged. Any
            share link stops working immediately. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger btn-small"
          onClick={deleteAccount}
          disabled={deleting}
        >
          {deleting
            ? "Deleting…"
            : armed
              ? "Tap again to delete everything"
              : "Delete account"}
        </button>
      </div>
    </section>
  );
}
