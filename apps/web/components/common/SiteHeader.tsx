"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import SignOutButton from "@/components/auth/SignOutButton";

export default function SiteHeader() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);
  const username = (session?.user as unknown as { username?: string })?.username;

  return (
    <header data-testid="site-header" className="w-full bg-white border-b border-gray-200">
      <div className="mx-auto max-w-5xl px-4">
        <nav className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Isntgram
            </Link>
            <div className="flex items-center gap-4 text-sm text-gray-700">
              <Link href="/" className="hover:text-gray-900">
                Home
              </Link>
              {isAuthenticated && username ? (
                <Link href={`/${username}`} className="hover:text-gray-900" data-testid="nav-profile-link">
                  Profile
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-100" aria-hidden />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3" data-testid="nav-authenticated">
                {username ? (
                  <span className="inline text-sm text-gray-600" aria-label="current-user">
                    @{username}
                  </span>
                ) : null}
                <SignOutButton variant="secondary" size="sm" />
              </div>
            ) : (
              <div className="flex items-center gap-3" data-testid="nav-unauthenticated">
                <Link
                  href="/login"
                  className="text-sm rounded-md border border-gray-300 px-3 py-1.5 text-gray-800 hover:bg-gray-50"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="text-sm rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
