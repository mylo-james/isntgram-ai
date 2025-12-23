"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import DemoBanner from "@/components/demo/DemoBanner";

interface SessionProviderProps {
  children: ReactNode;
}

export default function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      <DemoBanner />
      {children}
    </NextAuthSessionProvider>
  );
}
