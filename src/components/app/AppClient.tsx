"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "@/components/Dashboard";
import AuthPanel from "./AuthPanel";
import JobDialog, { type Draft } from "./JobDialog";
import SettingsCard from "./SettingsCard";
import ShareCard from "./ShareCard";
import { createClient } from "@/lib/supabase/client";
import type { Application, Profile } from "@/lib/types";

const COLUMNS =
  "id, role, company, description, location, salary, applied_on, status";

/** Empty strings from the form become NULL, not "". */
function clean(draft: Draft) {
  const orNull = (v: string) => (v.trim() ? v.trim() : null);
  return {
    role: draft.role.trim(),
    company: orNull(draft.company),
    description: orNull(draft.description),
    location: orNull(draft.location),
    salary: orNull(draft.salary),
    applied_on: draft.applied_on,
    status: draft.status,
  };
}

export default function AppClient() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setApps([]);
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const load = useCallback(async () => {
    // Neither query filters by user: row level security already restricts both
    // tables to the caller's own rows, so a client-side filter would be
    // decorative. This is the whole point of enforcing isolation in the database.
    const [{ data: rows }, { data: prof }] = await Promise.all([
      supabase
        .from("applications")
        .select(COLUMNS)
        .order("applied_on", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, display_name, headline, share_token, is_shared")
        .maybeSingle(),
    ]);
    setApps((rows ?? []) as Application[]);
    if (prof) setProfile(prof as Profile);
  }, [supabase]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function save(draft: Draft): Promise<string | null> {
    if (!session) return "Your session expired — sign in again.";
    const payload = clean(draft);

    const query = editing
      ? supabase.from("applications").update(payload).eq("id", editing.id)
      : supabase
          .from("applications")
          .insert({ ...payload, owner_id: session.user.id });

    const { error } = await query;
    if (error) return friendly(error.message);

    await load();
    setDialogOpen(false);
    setEditing(null);
    return null;
  }

  async function remove(app: Application): Promise<string | null> {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", app.id);
    if (error) return friendly(error.message);

    await load();
    setDialogOpen(false);
    setEditing(null);
    return null;
  }

  function friendly(message: string) {
    if (/row-level security|violates row-level/i.test(message)) {
      return "The database refused that write. Try signing out and back in.";
    }
    return message;
  }

  function patchProfile(next: Partial<Profile>) {
    setProfile((p) => (p ? { ...p, ...next } : p));
  }

  if (!ready) return null;
  if (!session) {
    // "Start your log" arrives as /app?mode=signup so the form opens on the
    // right tab instead of making a new visitor find the link.
    const mode =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("mode") === "signup"
        ? "signup"
        : "signin";
    return <AuthPanel supabase={supabase} initialMode={mode} />;
  }

  return (
    <>
      <Dashboard
        apps={apps}
        eyebrow={
          profile?.display_name ? `${profile.display_name}'s log` : "Your log"
        }
        onEdit={(app) => {
          setEditing(app);
          setDialogOpen(true);
        }}
      >
        {profile && (
          <ShareCard
            supabase={supabase}
            profile={profile}
            onProfileChange={patchProfile}
          />
        )}

        {showSettings && profile && (
          <SettingsCard
            supabase={supabase}
            profile={profile}
            email={session.user.email}
            onProfileChange={patchProfile}
          />
        )}

        <div className="admin-bar">
          <span className="admin-who">signed in as {session.user.email}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setShowSettings((s) => !s)}
            >
              {showSettings ? "Hide settings" : "Settings"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="addbar">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Log an application
          </button>
        </div>
      </Dashboard>

      <JobDialog
        open={dialogOpen}
        editing={editing}
        onSave={save}
        onDelete={remove}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
