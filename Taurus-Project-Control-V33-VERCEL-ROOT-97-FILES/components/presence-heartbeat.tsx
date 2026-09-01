"use client";

import { useEffect } from "react";

export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    const ping = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try { await fetch("/api/presence", { method: "POST", cache: "no-store" }); }
      catch { /* Presence is non-blocking. */ }
    };
    const initial = window.setTimeout(() => void ping(), 20_000);
    const timer = window.setInterval(() => void ping(), 900_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void ping(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
