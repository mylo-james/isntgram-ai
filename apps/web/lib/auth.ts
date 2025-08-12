import NextAuth, { type NextAuthConfig, type Session, type User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";

type JwtToken = JWT & { accessToken?: string; username?: string; isDemoUser?: boolean };
type AppSession = Session & {
  accessToken?: string;
  user: NonNullable<Session["user"]> & { id: string; username?: string; isDemoUser?: boolean };
};

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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Authenticate against backend API
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/auth/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error((error as { message?: string }).message || "Authentication failed");
        }

        const data = (await response.json()) as {
          user: { id: string; email: string; username: string; fullName: string };
          accessToken?: string;
          isDemoUser?: boolean;
        };

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.fullName,
          username: data.user.username,
          accessToken: data.accessToken,
          // isDemoUser will be set in jwt callback if present
        } as unknown as User & { username?: string; accessToken?: string };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Shorter maxAge for demo sessions; default 7 days otherwise
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt(params) {
      const token = params.token as JwtToken;
      const user = params.user as
        | (User & { accessToken?: string; username?: string; isDemoUser?: boolean })
        | undefined;
      if (user) {
        token.accessToken = user.accessToken;
        token.username = (user as unknown as { username?: string }).username;
      }

      // If we can detect demo sign-in intent via custom env, set a stable flag when demo credentials are used
      const maybeEmail = (params.account?.providerAccountId as string) || (user?.email as string | undefined);
      if (maybeEmail && maybeEmail === (process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai")) {
        token.isDemoUser = true;
      }

      return token;
    },
    async session(params) {
      const session = params.session as AppSession;
      const token = params.token as JwtToken;
      if (token) {
        if (token.sub) session.user.id = token.sub as string;
        if (token.username) session.user.username = token.username;
        if (token.accessToken) session.accessToken = token.accessToken;
        if (token.isDemoUser) session.user.isDemoUser = true;
      }
      return session;
    },
  },
  pages: { signIn: "/login", signOut: "/login" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers;
