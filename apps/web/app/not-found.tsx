import Link from "next/link";
import Brand from "@/components/ui/Brand";
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-5 py-16">
      <div className="mb-10">
        <Brand />
      </div>
      <h1 className="page-heading mb-4">Page not found</h1>
      <p className="text-gray-700">
        This profile or post may no longer be available. Check the link or return to Home.
      </p>
      <Link href="/feed" aria-label="Back to Home" className="return-link mt-5 -ml-2">
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
      <Link href="/explore" className="ui-quiet mt-5 ml-2">
        Find people
      </Link>
    </main>
  );
}
