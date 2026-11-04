"use client";

import { useEffect } from "react";

/** Registers the service worker and holds on to the browser's install prompt until the planner can offer it. */
export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const firstVisit = !navigator.serviceWorker.controller;
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          if (!firstVisit) return;
          const urls = performance
            .getEntriesByType("resource")
            .map((r) => r.name)
            .filter((u) => u.startsWith(location.origin + "/_next/static/"));
          reg.active?.postMessage({ type: "keep-loaded", urls, page: location.pathname === "/" });
        })
        .catch((e) => console.error("Service worker failed", e));
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__tiffinInstallPrompt = e;
      window.dispatchEvent(new Event("tiffin-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}
