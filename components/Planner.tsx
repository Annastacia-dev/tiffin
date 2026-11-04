"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
// @ts-ignore – plain JS module
import { mountPlanner } from "./planner-app.js";

export default function Planner({ name }: { name: string }) {
  useEffect(() => {
    mountPlanner();
  }, []);

  return (
    <>
      <header>
        <div className="headrow">
          <div>
            <h1>Tiffin</h1>
            {name && <p className="sub">Hi {name} – here's what's in your lunchbox.</p>}
          </div>
          <button type="button" className="signout" onClick={() => signOut({ callbackUrl: "/signin" })}>
            Sign out
          </button>
        </div>
      </header>
      <nav aria-label="Main"><div className="tabs" id="nav" /></nav>
      <div id="banner" role="status" />
      <main id="main"><p className="muted">Loading your plan…</p></main>
      <div id="toast" role="status" aria-live="polite" />
      <div id="busy" hidden>
        <div className="busybox" role="dialog" aria-modal="true" aria-labelledby="busytext">
          <div className="spinner" />
          <div id="busytext" aria-live="polite">Working…</div>
          <button className="btn ghost" id="busycancel">Cancel</button>
        </div>
      </div>
    </>
  );
}
