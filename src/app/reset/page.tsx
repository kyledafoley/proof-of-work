"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for the reset link in the email. Supabase puts the recovery
 * session in the URL fragment, and the client library picks it up on load —
 * so by the time this renders, updateUser is authorized.
 */
export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthorized(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthorized(Boolean(session));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setDone(true);
    setBusy(false);
  }

  if (!ready) return null;

  return (
    <main className="page">
      <form className="signin" onSubmit={submit}>
        <h1>Set a new password</h1>

        {!authorized ? (
          <p className="form-note">
            This reset link has expired or was already used. Request a fresh one
            from the sign-in page.
          </p>
        ) : done ? (
          <>
            <p className="form-note">Password updated.</p>
            <a className="btn" href="/app">
              Go to your log
            </a>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
