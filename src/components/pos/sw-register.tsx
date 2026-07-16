"use client";

import { useEffect } from "react";

// Registers the till's service worker for offline app-shell caching. A no-op
// where service workers are unavailable or the origin isn't secure (SW requires
// HTTPS or localhost) — registration failures are non-fatal; the till still runs
// online. Rendered inside the till so the SW is only installed on the POS route.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal: the till works online without the SW */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
