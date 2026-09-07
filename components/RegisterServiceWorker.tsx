"use client";

import { useEffect } from "react";

// Registers the PWA service worker. A component (not inline in the layout)
// because navigator.serviceWorker only exists client-side.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not something worth surfacing an
        // error for if a browser/extension blocks it.
      });
    }
  }, []);

  return null;
}
