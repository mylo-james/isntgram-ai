import "server-only";
import NextAuth, { type NextAuthConfig, type Session, type User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { LoginResponse } from "@isntgram-ai/shared-types";
import { getApiErrorMessage } from "./api-error";
import { internalApi } from "./server-api";

type JwtToken = JWT & { accessToken?: string; username?: string; isDemoUser?: boolean };

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

function isLocalHostUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const trustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  // Enable in CI/e2e runs and local Docker/production-mode runs (Next `start`).
  Boolean(process.env.CI) ||
  isLocalHostUrl(process.env.NEXTAUTH_URL) ||
  isLocalHostUrl(process.env.NEXT_PUBLIC_APP_URL) ||
  // Auth.js can infer this on some platforms, but being explicit is safer.
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.CF_PAGES) ||
  // Default for local dev.
  process.env.NODE_ENV !== "production";

const authConfig: NextAuthConfig = {
  trustHost,
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

        const payload = data as LoginResponse;

        return {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.fullName,
          username: payload.user.username,
          accessToken: payload.accessToken,
          isDemoUser: payload.isDemoUser,
        } as unknown as User & { username?: string; accessToken?: string };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: sessionMaxAgeSeconds },
  jwt: { maxAge: sessionMaxAgeSeconds },
  callbacks: {
    async jwt(params) {
      const token = params.token as JwtToken;
      const user = params.user as
        | (User & { accessToken?: string; username?: string; isDemoUser?: boolean })
        | undefined;
      if (user) {
        token.accessToken = user.accessToken;
        token.username = (user as unknown as { username?: string }).username;
        if (user.isDemoUser) token.isDemoUser = true;
      }

      // If we can detect demo sign-in intent via custom env, set a stable flag when demo credentials are used
      const maybeEmail = (params.account?.providerAccountId as string) || (user?.email as string | undefined);
      if (
        process.env.NEXT_PUBLIC_DEMO_ENABLED === "true" &&
        maybeEmail &&
        maybeEmail === (process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai")
      ) {
        token.isDemoUser = true;
      }

      return token;
    },
    async session(params) {
      const session = params.session as Session;
      const token = params.token as JwtToken;
      if (token) {
        if (token.sub) session.user.id = token.sub as string;
        if (token.username) session.user.username = token.username;
        if (token.isDemoUser) session.user.isDemoUser = true;
      }
      return session;
    },
  },
  pages: { signIn: "/login", signOut: "/login" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers;
