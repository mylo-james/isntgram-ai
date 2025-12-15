"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Focusable = HTMLElement & { disabled?: boolean };

function getFocusableElements(container: HTMLElement): Focusable[] {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  const nodes = Array.from(container.querySelectorAll<Focusable>(selectors));
  return nodes.filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
}

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  testId?: string;
}

export default function Modal({ open, title, description, onClose, children, contentClassName, testId }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descriptionId = useId();

  const labelledBy = useMemo(() => titleId, [titleId]);
  const describedBy = useMemo(() => (description ? descriptionId : undefined), [description, descriptionId]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      (focusables[0] ?? closeButtonRef.current)?.focus();
    };

    const timer = window.setTimeout(focusInitial, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as Focusable | null;

      if (e.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [open, onClose, description]);

  if (!open) return null;

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleOverlayMouseDown}
      data-testid={testId}
    >
      <div
        ref={panelRef}
        className={cn("w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl mx-4", contentClassName)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-gray-600">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
