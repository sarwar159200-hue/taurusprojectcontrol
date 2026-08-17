"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true
    });
  }, [pathname]);

  return null;
}
