import "server-only";
import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import { getServerSession } from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { LoginResponse } from "@isntgram-ai/shared-types";
import { getApiErrorMessage } from "./api-error";
import { internalApi } from "./server-api";

type JwtToken = JWT & { accessToken?: string; username?: string; isDemoUser?: boolean; demoExpiresAt?: string };

function parseDurationSeconds(value: string | undefined, fallbackSeconds: number): number {
  if (!value) return fallbackSeconds;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return fallbackSeconds;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return Math.max(1, Math.floor(numeric));
  }

  const match = trimmed.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;

  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 1);
}

const sessionMaxAgeSeconds = parseDurationSeconds(
  process.env.AUTH_SESSION_MAX_AGE ?? process.env.NEXTAUTH_SESSION_MAX_AGE,
  60 * 60 * 24 * 7,
);

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";
        const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai";
        const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo";
        const isDemoCredentials = demoEnabled && email === demoEmail && password === demoPassword;

        // Authenticate against backend API
        const { data, error, response } = isDemoCredentials
          ? await internalApi.POST("/api/auth/demo", { cache: "no-store" })
          : await internalApi.POST("/api/auth/login", {
              body: { email, password },
              cache: "no-store",
            });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          throw new Error(getApiErrorMessage(error, "Authentication failed"));
        }

        if (!data) {
          throw new Error("Authentication failed");
        }

        const payload = data as LoginResponse & { demoExpiresAt?: string };

        return {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.fullName,
          username: payload.user.username,
          accessToken: payload.accessToken,
          isDemoUser: payload.isDemoUser,
          demoExpiresAt: payload.demoExpiresAt,
        } as unknown as User & { username?: string; accessToken?: string };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: sessionMaxAgeSeconds },
  jwt: { maxAge: sessionMaxAgeSeconds },
  callbacks: {
    async jwt({ token, user }) {
      const jwtToken = token as JwtToken;
      const jwtUser = user as
        | (User & { accessToken?: string; username?: string; isDemoUser?: boolean; demoExpiresAt?: string })
        | undefined;
      if (jwtUser) {
        jwtToken.accessToken = jwtUser.accessToken;
        jwtToken.username = (jwtUser as unknown as { username?: string }).username;
        if (jwtUser.isDemoUser) jwtToken.isDemoUser = true;
        if (jwtUser.demoExpiresAt) jwtToken.demoExpiresAt = jwtUser.demoExpiresAt;
      }

      return jwtToken;
    },
    async session({ session, token }) {
      const appSession = session as Session;
      const jwtToken = token as JwtToken;
      if (jwtToken) {
        if (jwtToken.sub) appSession.user.id = jwtToken.sub as string;
        if (jwtToken.username) appSession.user.username = jwtToken.username;
        if (jwtToken.isDemoUser) appSession.user.isDemoUser = true;
        if (jwtToken.demoExpiresAt) appSession.user.demoExpiresAt = jwtToken.demoExpiresAt;
      }
      return appSession;
    },
  },
  pages: { signIn: "/login", signOut: "/login" },
};

const handler = NextAuth(authOptions);

export const GET = handler;
export const POST = handler;

export function auth() {
  return getServerSession(authOptions);
}
