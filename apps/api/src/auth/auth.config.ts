import { AuthConfig } from '@auth/core';
import CredentialsProvider from '@auth/core/providers/credentials';

export const authConfig: AuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(
        credentials: Partial<Record<'email' | 'password', unknown>>,
      ) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        // This would need to be implemented with your AuthService
        // For now, return null
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Safely propagate standard fields
        if (typeof (user as { email?: unknown }).email === 'string') {
          token.email = (user as { email: string }).email;
        }
        if (typeof (user as { name?: unknown }).name === 'string') {
          token.name = (user as { name: string }).name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === 'string') {
          session.user.email = token.email;
        }
        if (typeof token.name === 'string') {
          session.user.name = token.name;
        }
      }
      return session;
    },
  },
};
