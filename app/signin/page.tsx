"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function SignInInner() {
  const urlError = useSearchParams().get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(urlError ? "Wrong email or password." : "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) window.location.href = "/";
    else {
      setError("Wrong email or password.");
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <form className="card" onSubmit={submit}>
        <h1>Tiffin</h1>
        <p className="muted">Sign in to open your meal plan.</p>
        {error && <div className="warnbox">{error}</div>}
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}
