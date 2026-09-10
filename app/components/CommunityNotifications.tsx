"use client";

import { useEffect, useState } from "react";
import { NOTIFICATIONS_CHANGED, type UnreadCounts } from "../../lib/notifications";

function NotificationLink({ href, label, count }: { href: string; label: string; count: number }) {
  return <a className="notification-link" href={href} aria-label={`${label}${count ? `, ${count} unread ${label === "Campfire" ? "posts and replies" : "messages"}` : ""}`}>
    {label}
    {count > 0 && <span className="notification-indicator" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      <span className="nav-unread">{count > 99 ? "99+" : count}</span>
    </span>}
  </a>;
}

export function CommunityNotifications({ signedIn }: { signedIn: boolean }) {
  const [counts, setCounts] = useState<UnreadCounts>({ campfire: 0, messages: 0 });
  useEffect(() => {
    if (!signedIn) return;
    let stopped = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      const active = new AbortController();
      controller = active;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: active.signal });
        if (stopped || active.signal.aborted) return;
        if (response.status === 403) { setCounts({ campfire: 0, messages: 0 }); return; }
        if (response.ok) {
          const next = await response.json() as UnreadCounts;
          if (!stopped && !active.signal.aborted) setCounts(next);
        }
      } catch { /* Keep the last known count during a temporary connection failure. */ }
    }
    void refresh();
    const interval = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [signedIn]);
  return <><NotificationLink href="/campfire" label="Campfire" count={counts.campfire}/><NotificationLink href="/messages" label="Messages" count={counts.messages}/></>;
}
