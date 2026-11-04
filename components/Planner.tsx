"use client";

import { useEffect } from "react";
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
          <a className="signout" href="/api/auth/signout">Sign out</a>
        </div>
      </header>
      <nav><div className="tabs" id="nav" /></nav>
      <div id="banner" />
      <main id="main"><p className="muted">Loading your plan…</p></main>
      <div id="toast" />
      <div id="busy" hidden>
        <div className="busybox">
          <div className="spinner" />
          <div id="busytext">Working…</div>
          <button className="btn ghost" id="busycancel">Cancel</button>
        </div>
      </div>
    </>
  );
}
