"use client";

import { useSession } from "next-auth/react";

export default function DemoBanner() {
  const { data: session } = useSession();
  const isDemoUser = Boolean(session?.user && (session.user as unknown as { isDemoUser?: boolean }).isDemoUser);

  if (!isDemoUser) return null;

  return (
    <div className="w-full bg-amber-100 border-b border-amber-200 text-amber-900 text-sm">
      <div className="max-w-5xl mx-auto px-4 py-2 text-center">
        Demo mode: this account is read-only. Some actions are disabled.
      </div>
    </div>
  );
}
