"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const STORAGE_KEY = "isntgram.demoBannerDismissed.v1";
const TICK_MS = 30_000;

function formatRemaining(msRemaining: number): string {
  if (!Number.isFinite(msRemaining)) return "soon";
  if (msRemaining <= 0) return "now";

  const totalSeconds = Math.ceil(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  if (parts.length === 0) return "moments";
  return parts.slice(0, 2).join(" ");
}

export default function DemoBanner() {
  const { data: session } = useSession();
  const isDemoUser = Boolean(session?.user?.isDemoUser);
  const demoExpiresAtRaw = session?.user?.demoExpiresAt ?? null;

  const [dismissed, setDismissed] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // Show the disclosure unless a saved dismissal can actually be read.
    }

    queueMicrotask(() => setDismissed(stored));
  }, []);

  useEffect(() => {
    if (!isDemoUser) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [isDemoUser]);

  useEffect(() => {
    const root = document.documentElement;
    const setHeight = (height: number) => root.style.setProperty("--demo-banner-height", `${height}px`);

    if (!isDemoUser || dismissed) {
      setHeight(0);
      return;
    }

    const el = containerRef.current;
    if (!el) {
      setHeight(0);
      return;
    }

    const update = () => setHeight(el.offsetHeight);
    update();

    if (typeof ResizeObserver === "undefined") {
      return () => setHeight(0);
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(el);

    return () => {
      observer.disconnect();
      setHeight(0);
    };
  }, [dismissed, isDemoUser]);

  const demoExpiresAt = useMemo(() => {
    if (!demoExpiresAtRaw) return null;
    const parsed = new Date(demoExpiresAtRaw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [demoExpiresAtRaw]);

  const remainingLabel = useMemo(() => {
    if (!demoExpiresAt) return null;
    return formatRemaining(demoExpiresAt.getTime() - now);
  }, [demoExpiresAt, now]);

  if (!isDemoUser || dismissed) return null;

  const title = demoExpiresAt
    ? remainingLabel === "now"
      ? "Demo session expired"
      : `Demo session expires in ${remainingLabel}`
    : "Demo session";

  const subtitle =
    process.env.NEXT_PUBLIC_DEPLOYMENT_DEMO === "true"
      ? "Your demo lasts 48 hours. Expired accounts and uploads are removed during daily cleanup."
      : process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE === "curated"
      ? "Curated examples use fictional profiles and credited photographs. Session access expires; demo data is retained for review."
      : process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE === "community"
        ? "A fictional community with generated avatars and credited photos. Your account is temporary."
        : "This is a temporary demo account. Session access ends at the expiry shown above.";

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore localStorage failures (e.g. privacy mode).
    }
    setDismissed(true);
  };

  return (
    <div ref={containerRef} className="demo-session-banner fixed left-0 right-0 top-0 z-[200] border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 px-4 py-2 sm:items-center">
        <div>
          <div className="demo-full-description"><p className="text-sm font-semibold text-amber-950">{title}</p>
          <p className="text-xs text-amber-800">{subtitle}</p></div>
          <p className="demo-compact-description hidden text-xs text-amber-950">{remainingLabel === "now" ? "This demo has expired." : process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE === "community" ? "Temporary demo. Fictional community." : "Demo session. Temporary access."}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {remainingLabel === "now" ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="ui-action rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in again
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDismiss}
            className="ui-action px-3 text-xs text-amber-900 hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
