"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "@/components/Dashboard";
import JobDialog, { type Draft } from "./JobDialog";
import SignIn from "./SignIn";
import { createClient } from "@/lib/supabase/client";
import type { Application } from "@/lib/types";

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

export default function AdminClient() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const load = useCallback(async () => {
    // app_admins lets a signed-in user read only their own row, so this query
    // returns exactly one row for a writer and nothing for anyone else.
    const [{ data: rows }, { data: membership }] = await Promise.all([
      supabase.from("applications").select(COLUMNS).order("applied_on", {
        ascending: false,
      }),
      supabase.from("app_admins").select("user_id").maybeSingle(),
    ]);
    setApps((rows ?? []) as Application[]);
    setIsAdmin(Boolean(membership));
  }, [supabase]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function save(draft: Draft): Promise<string | null> {
    const payload = clean(draft);
    const query = editing
      ? supabase.from("applications").update(payload).eq("id", editing.id)
      : supabase.from("applications").insert(payload);

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
      return "This account is not on the writers allowlist, so the database refused the change.";
    }
    return message;
  }

  if (!ready) return null;
  if (!session) return <SignIn supabase={supabase} />;

  return (
    <>
      <Dashboard
        apps={apps}
        onEdit={
          isAdmin
            ? (app) => {
                setEditing(app);
                setDialogOpen(true);
              }
            : undefined
        }
      >
        <div className="admin-bar">
          <span className="admin-who">
            signed in as {session.user.email}
            {isAdmin === false && " · not on the writers allowlist"}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>

        {isAdmin && (
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
        )}
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
