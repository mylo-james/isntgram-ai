import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600">The page you’re looking for doesn’t exist or has moved.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Go home
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Search
        </Link>
      </div>
    </main>
  );
}
