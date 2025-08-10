"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") {
      // Still loading, don't do anything yet
      return;
    }

    if (status === "unauthenticated") {
      // User is not authenticated, redirect to login
      router.push("/login");
    }
  }, [status, session, router]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">Isntgram</h1>
              <p className="mt-2 text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      )
    );
  }

  // Show loading state while redirecting
  if (status === "unauthenticated") {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">Isntgram</h1>
              <p className="mt-2 text-sm text-gray-600">Redirecting to login...</p>
            </div>
          </div>
        </div>
      )
    );
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
