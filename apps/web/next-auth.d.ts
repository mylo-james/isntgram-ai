import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      isDemoUser?: boolean;
      demoExpiresAt?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    username?: string;
    accessToken?: string;
    isDemoUser?: boolean;
    demoExpiresAt?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    username?: string;
    isDemoUser?: boolean;
    demoExpiresAt?: string;
  }
}
