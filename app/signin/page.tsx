"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInInner() {
  const error = useSearchParams().get("error");
  return (
    <div className="signin">
      <div className="card">
        <h1>Tiffin</h1>
        <p className="muted">Sign in to see your plan, recipes and shopping list.</p>
        {error && (
          <div className="warnbox">
            {error === "AccessDenied" ? "This Google account isn't allowed to use this planner." : "Sign-in failed. Please try again."}
          </div>
        )}
        <button className="btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Continue with Google
        </button>
      </div>
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
