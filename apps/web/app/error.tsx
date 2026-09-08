"use client";
import Link from "next/link";
import ErrorNotice from "@/components/ui/ErrorNotice";
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-heading mb-4">This page couldn’t load</h1>
      <ErrorNotice
        message="We couldn’t finish loading this page. Check your connection and try again."
        onRetry={reset}
        retryLabel="Retry page"
      />
      <Link className="ui-action mt-4 text-blue-700 underline" href="/feed">
        Back to Home
      </Link>
    </main>
  );
}
