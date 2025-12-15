import { Suspense } from "react";
import SearchPageClient from "./search-page-client";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-gray-600">Loading…</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
