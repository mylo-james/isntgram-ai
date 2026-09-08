"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CircleMark from "./CircleMark";

export default function Brand({ className = "", href = "/feed" }: { className?: string; href?: string }) {
  const [animating, setAnimating] = useState(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const legacyPreference = preference as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    const update = () => {
      reducedMotion.current = preference.matches;
      if (preference.matches) setAnimating(false);
    };
    const hide = () => {
      if (document.hidden) setAnimating(false);
    };
    update();
    if (preference.addEventListener) preference.addEventListener("change", update);
    else legacyPreference.addListener?.(update);
    document.addEventListener("visibilitychange", hide);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener("change", update);
      else legacyPreference.removeListener?.(update);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  useEffect(() => {
    if (!animating) return;
    // A complete cycle starts and ends at the open frame, even after pointer exit.
    const cycle = window.setInterval(() => {
      if (!hovered.current && !focused.current) setAnimating(false);
    }, 4000);
    return () => window.clearInterval(cycle);
  }, [animating]);

  const start = useCallback(() => {
    if (!reducedMotion.current) setAnimating(true);
  }, []);

  return (
    <Link
      href={href}
      aria-label="Isntgram home"
      className={`brand-lockup brand-link rounded-lg ${className}`}
      data-animating={animating}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          hovered.current = true;
          start();
        }
      }}
      onPointerLeave={() => {
        hovered.current = false;
      }}
      onFocus={(event) => {
        focused.current = event.currentTarget.matches(":focus-visible");
        if (focused.current) start();
      }}
      onBlur={() => {
        focused.current = false;
      }}
    >
      <span className="brand-motion">
        <CircleMark size={64} className="brand-mark" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo.svg" alt="Isntgram logo" className="brand-wordmark" />
    </Link>
  );
}
