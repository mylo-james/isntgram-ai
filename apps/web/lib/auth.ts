import NextAuth, { type NextAuthConfig, type Session, type User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { LoginResponse } from "@isntgram-ai/shared-types";
import { getApiErrorMessage } from "./api-error";
import { internalApi } from "./server-api";

type JwtToken = JWT & { accessToken?: string; username?: string; isDemoUser?: boolean };

const authConfig: NextAuthConfig = {
  trustHost: true,
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

        const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai";
        const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo";
        const isDemoCredentials = email === demoEmail && password === demoPassword;

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
  session: { strategy: "jwt" },
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
      if (maybeEmail && maybeEmail === (process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai")) {
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
