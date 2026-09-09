"use client";
import Link from "next/link";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Brand from "@/components/ui/Brand";
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-5 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="page-heading mb-4">This page couldn’t load</h1>
      <ErrorNotice
        message="We couldn’t finish loading this page. Check your connection and try again."
        onRetry={reset}
        retryLabel="Retry page"
      />
      <Link className="return-link mt-4 -ml-2" href="/feed" aria-label="Back to Home">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m14 7-5 5 5 5" />
        </svg>
        Home
      </Link>
    </main>
  );
}
