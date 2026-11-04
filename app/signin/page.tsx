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

  useEffect(() => {
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
    <div className="signin">
      <form className="card" onSubmit={submit}>
        <h1>Tiffin</h1>
        <p className="muted">
          {mode === "loading" ? "Loading…" : signup ? "Create your account to start planning." : "Sign in to open your meal plan."}
        </p>
        {error && <div className="warnbox">{error}</div>}
        {mode !== "loading" && (
          <>
            {signup && (
              <input type="text" required placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input type="email" required autoFocus placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              type="password"
              required
              minLength={signup ? 8 : undefined}
              placeholder={signup ? "Password (8+ characters)" : "Password"}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {signup && (
              <input type="password" required placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
