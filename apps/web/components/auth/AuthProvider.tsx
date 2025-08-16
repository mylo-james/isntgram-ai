"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUser, clearAuth } from "@/lib/store/auth-slice";
import { apiClient } from "@/lib/api-client";

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession() as {
    data:
      | (Session & {
          accessToken?: string;
          user?: Session["user"] & { id?: string; username?: string; isDemoUser?: boolean };
        })
      | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const dispatch = useDispatch();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "authenticated" && session && session.user) {
      const user = {
        id: (session.user.id as string) || "",
        email: session.user.email || "",
        username: (session.user.username as string) || "",
        fullName: session.user.name || "",
        isDemoUser: Boolean((session.user as unknown as { isDemoUser?: boolean }).isDemoUser),
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date().toISOString(),
      };

      dispatch(setUser(user));

      // Set bearer token for API client if present
      apiClient.setBearerToken(session.accessToken || null);
    } else if (status === "unauthenticated") {
      dispatch(clearAuth());
      apiClient.setBearerToken(null);
    }
  }, [status, session, dispatch]);

  return <>{children}</>;
}
