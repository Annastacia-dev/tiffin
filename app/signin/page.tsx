"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

export default function SignIn() {
  const [mode, setMode] = useState<"loading" | "signin" | "signup">("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    // NextAuth sends failures it can't report to the form back here with ?error=
    if (new URLSearchParams(window.location.search).has("error")) setError("Something went wrong signing in. Please try again.");
    fetch("/api/signup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMode(j.open ? "signup" : "signin"))
      .catch(() => setMode("signin"));
  }, []);

  async function doSignIn() {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) window.location.href = "/";
    else {
      setError("Wrong email or password.");
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup") {
      if (password !== confirm) return setError("The passwords don't match.");
      setBusy(true);
      const r = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBusy(false);
        if (r.status === 403) setMode("signin");
        return setError(j.error || "Couldn't create your account.");
      }
    } else setBusy(true);
    await doSignIn();
  }

  const signup = mode === "signup";
  return (
    <main className="signin">
      <form className="card" onSubmit={submit}>
        <h1>Tiffin</h1>
        <p className="muted">
          {mode === "loading" ? "Loading…" : signup ? "Create your account to start planning." : "Sign in to open your meal plan."}
        </p>
        {error && <div className="warnbox" role="alert">{error}</div>}
        {mode !== "loading" && (
          <>
            {signup && (
              <label className="field">
                <span>Your name</span>
                <input type="text" required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" required autoFocus={!signup} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <span className="pwrow">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={signup ? 8 : undefined}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="link" aria-pressed={showPw} onClick={() => setShowPw(!showPw)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </span>
              {signup && <small className="muted">At least 8 characters.</small>}
            </label>
            {signup && (
              <label className="field">
                <span>Confirm password</span>
                <input type={showPw ? "text" : "password"} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
