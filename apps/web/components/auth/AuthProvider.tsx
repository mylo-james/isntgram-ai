"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken || null;
    apiClient.setBearerToken(status === "authenticated" ? accessToken : null);
  }, [status, session]);

  return <>{children}</>;
}
