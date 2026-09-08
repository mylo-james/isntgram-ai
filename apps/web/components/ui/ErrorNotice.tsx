"use client";

import { useRef, useState } from "react";
import Button from "./Button";

/** Dismissing a notice does not dismiss the operation or its recovery action. */
export default function ErrorNotice({
  message,
  onRetry,
  retryLabel = "Try again",
  pending = false,
  persistentSummary,
  id,
}: {
  id?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  pending?: boolean;
  persistentSummary?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const recoveryRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={recoveryRef} tabIndex={-1} className="error-notice" aria-label="Action recovery">
      {!dismissed ? (
        <p id={id} role="alert">
          {message}
        </p>
      ) : persistentSummary ? (
        <p id={id} role="status">
          {persistentSummary}
        </p>
      ) : id ? (
        <span id={id} className="sr-only">
          {message}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {message.startsWith("Your session has expired") ? (
          <a
            href="/login"
            target="_blank"
            rel="noopener noreferrer"
            className="ui-action border border-gray-500 underline"
          >
            Log in (new tab)
          </a>
        ) : null}
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry} disabled={pending}>
            {pending ? "Trying again…" : retryLabel}
          </Button>
        ) : null}
        {!dismissed ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDismissed(true);
              recoveryRef.current?.focus();
            }}
          >
            Dismiss message
          </Button>
        ) : null}
      </div>
    </div>
  );
}
