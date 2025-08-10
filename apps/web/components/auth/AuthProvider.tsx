"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUser, clearAuth } from "@/lib/store/auth-slice";

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession() as {
    data: (Session & { accessToken?: string; user?: Session["user"] & { id?: string; username?: string } }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const dispatch = useDispatch();

  useEffect(() => {
    if (status === "loading") {
      // Still loading, don't do anything yet
      return;
    }

    if (status === "authenticated" && session && session.user) {
      // User is authenticated, sync with Redux
      const user = {
        id: (session.user.id as string) || "",
        email: session.user.email || "",
        username: (session.user.username as string) || "",
        fullName: session.user.name || "",
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date().toISOString(),
      };

      dispatch(setUser(user));

      // Access token storage removed; rely on NextAuth session only
    } else if (status === "unauthenticated") {
      // User is not authenticated, clear Redux state
      dispatch(clearAuth());
    }
  }, [status, session, dispatch]);

  return <>{children}</>;
}
