"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const send = () => {
      const body = JSON.stringify({ path: pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    };
    const idle = window.setTimeout(send, 10_000);
    return () => window.clearTimeout(idle);
  }, [pathname]);

  return null;
}
