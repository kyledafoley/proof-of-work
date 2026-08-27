"use client";

import { useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

type Mode = "signin" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; blurb: string; cta: string }> = {
  signin: {
    title: "Sign in",
    blurb: "Pick up where your log left off.",
    cta: "Sign in",
  },
  signup: {
    title: "Start your log",
    blurb:
      "Free. Log what you apply to, get a private link you can send to whoever keeps asking.",
    cta: "Create account",
  },
  forgot: {
    title: "Reset your password",
    blurb: "We'll email you a link to set a new one.",
    cta: "Send reset link",
  },
};

export default function AuthPanel({
  supabase,
  initialMode = "signin",
}: {
  supabase: SupabaseClient;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = COPY[mode];

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) setError(error.message);
      else
        setNotice(
          "If that address has an account, a reset link is on its way. Check spam if it doesn't land.",
        );
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setError("Use at least 8 characters.");
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) setError(error.message);
      else if (data.session) {
        // Email confirmation is off — the session is live immediately.
        setNotice("Account created.");
      } else {
        setNotice(
          "Check your email to confirm the address, then come back and sign in.",
        );
      }
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <main className="page">
      <form className="signin" onSubmit={submit}>
        <h1>{copy.title}</h1>
        <p className="form-note">{copy.blurb}</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {mode !== "forgot" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-note">{notice}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Working…" : copy.cta}
        </button>

        <div className="auth-switch">
          {mode === "signin" && (
            <>
              <button type="button" onClick={() => switchTo("signup")}>
                Create an account
              </button>
              <button type="button" onClick={() => switchTo("forgot")}>
                Forgot password
              </button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" onClick={() => switchTo("signin")}>
              I already have an account
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => switchTo("signin")}>
              Back to sign in
            </button>
          )}
        </div>

        <p className="fine-print">
          Your log is private until you share its link. <Link href="/">What is this?</Link>
        </p>
      </form>
    </main>
  );
}
