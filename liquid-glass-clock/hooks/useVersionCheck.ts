"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const currentVersion = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentVersion) return;

    const check = async () => {
      try {
        const res = await fetch("/api/version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data: { version: string } = await res.json();
        if (data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // Silently ignore — no network, server down, etc.
      }
    };

    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { updateAvailable };
}
