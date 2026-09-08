"use client";

import { useState } from "react";
import Link from "next/link";
import CircleMark from "./CircleMark";

export default function Brand({ className = "", href }: { className?: string; href?: string }) {
  const [paused, setPaused] = useState(false);
  const wordmark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/assets/logo.svg" alt="Isntgram logo" className="brand-wordmark" />
  );

  return (
    <span className={`brand-lockup ${className}`}>
      <span className="brand-motion" data-paused={paused}>
        <CircleMark size={40} className="brand-mark" />
        <button
          type="button"
          className="brand-motion-toggle"
          aria-label={paused ? "Play logo animation" : "Pause logo animation"}
          title={paused ? "Play logo animation" : "Pause logo animation"}
          onClick={() => setPaused(!paused)}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d={paused ? "M4 2v12l10-6z" : "M3 2h4v12H3zm6 0h4v12H9z"} />
          </svg>
        </button>
      </span>
      {href ? (
        <Link href={href} aria-label="Isntgram home" className="brand-link rounded-lg">
          {wordmark}
        </Link>
      ) : (
        wordmark
      )}
    </span>
  );
}
