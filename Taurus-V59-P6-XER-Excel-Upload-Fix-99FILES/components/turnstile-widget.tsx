"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `taurus-turnstile-${reactId}`;
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let attempts = 0;

    const render = () => {
      if (cancelled || widgetId.current || !window.turnstile) return;
      const target = document.getElementById(containerId);
      if (!target) return;
      widgetId.current = window.turnstile.render(target, {
        sitekey: siteKey,
        theme: "auto",
        size: "flexible",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken("")
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-taurus-turnstile="true"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.taurusTurnstile = "true";
      script.onload = render;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      render();
    } else {
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile) { window.clearInterval(timer); render(); }
        else if (attempts > 50) window.clearInterval(timer);
      }, 100);
      return () => { cancelled = true; window.clearInterval(timer); };
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [containerId, onToken, siteKey]);

  if (!siteKey) {
    return <div className="form-message">Security verification is not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel.</div>;
  }
  return <div id={containerId} className="turnstile-container" aria-label="Security verification" />;
}
