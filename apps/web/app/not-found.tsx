import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-heading mb-4">Page not found</h1>
      <p className="text-gray-700">
        This profile or post may no longer be available. Check the link or return to Home.
      </p>
      <Link href="/feed" className="ui-action mt-5 border border-gray-400">
        Back to Home
      </Link>
      <Link href="/explore" className="ui-action mt-5 text-blue-700 underline">
        Find people
      </Link>
    </main>
  );
}
