"use client";

import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  overlayClassName?: string;
  contentClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeOnOverlayClick?: boolean;
  "data-testid"?: string;
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return nodes.filter((node) => {
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.hasAttribute("hidden")) return false;
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

export default function Dialog({
  open,
  onClose,
  children,
  overlayClassName,
  contentClassName,
  initialFocusRef,
  closeOnOverlayClick = true,
  ...ariaProps
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const overlayClasses = useMemo(
    () =>
      overlayClassName ??
      "fixed inset-0 z-[300] m-0 flex h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-black/50 p-4",
    [overlayClassName],
  );

  const contentClasses = useMemo(() => contentClassName ?? "w-full max-w-md", [contentClassName]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    const focusTimer = window.setTimeout(() => {
      const fallback = getFocusableElements(contentRef.current)[0] ?? contentRef.current;
      (initialFocusRef?.current ?? fallback)?.focus?.();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!contentRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }

      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (!active || active === first || !contentRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      role="dialog"
      aria-modal="true"
      className={overlayClasses}
      onMouseDown={(event) => {
        if (!closeOnOverlayClick) return;
        if (event.target === event.currentTarget) onClose();
      }}
      {...ariaProps}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`${contentClasses} max-h-full overflow-y-auto`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
