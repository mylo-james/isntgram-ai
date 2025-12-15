"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">Please try again. If this keeps happening, return to the home page.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
