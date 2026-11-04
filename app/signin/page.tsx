"use client";

import { getProviders, signIn } from "next-auth/react";
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
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    // NextAuth sends failures it can't report to the form back here with ?error=
    const failure = new URLSearchParams(window.location.search).get("error");
    if (failure)
      setError(
        failure === "AccessDenied"
          ? "That Google account can't open this Tiffin. Use the Google account with the same email as your Tiffin account."
          : "Something went wrong signing in. Please try again."
      );
    getProviders()
      .then((p) => setGoogle(!!p?.google))
      .catch(() => {});
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
        <h1 className="brand"><img src="/icons/logo.svg" alt="" width={34} height={34} />tiffin.</h1>
        <p className="muted">
          {mode === "loading" ? "Loading…" : signup ? "Create your account to start planning." : "Sign in to open your meal plan."}
        </p>
        {error && <div className="warnbox" role="alert">{error}</div>}
        {mode !== "loading" && (
          <>
            {google && (
              <>
                <button
                  type="button"
                  className="btn ghost google"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    signIn("google", { callbackUrl: "/" });
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Continue with Google
                </button>
                <div className="or"><span>or</span></div>
              </>
            )}
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
                <button type="button" className="pweye" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(!showPw)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPw && <path d="M4 4l16 16" />}
                  </svg>
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
