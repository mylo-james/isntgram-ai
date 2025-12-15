"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "error";

export interface ToastInput {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastRecord {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const record: ToastRecord = {
        id: makeId(),
        title: input.title,
        message: input.message,
        variant: input.variant ?? "info",
        durationMs: input.durationMs ?? 4000,
      };

      setToasts((prev) => [...prev, record]);

      const timer = window.setTimeout(() => dismiss(record.id), record.durationMs);
      timersRef.current.set(record.id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto w-full max-w-md rounded-md border bg-white p-3 shadow-lg",
              t.variant === "success" && "border-green-200 bg-green-50 text-green-900",
              t.variant === "error" && "border-red-200 bg-red-50 text-red-900",
              t.variant === "info" && "border-gray-200 bg-white text-gray-900",
            )}
            role="status"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
                <div className="text-sm">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className={cn(
                  "rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-500",
                  t.variant === "success" && "text-green-700 hover:text-green-900",
                  t.variant === "error" && "text-red-700 hover:text-red-900",
                  t.variant === "info" && "text-gray-600 hover:text-gray-900",
                )}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
