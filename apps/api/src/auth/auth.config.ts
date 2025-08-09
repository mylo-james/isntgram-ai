import { AuthConfig } from '@auth/core';
import CredentialsProvider from '@auth/core/providers/credentials';
import { AuthService } from './auth.service';

export const buildAuthConfig = (authService: AuthService): AuthConfig => ({
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
        const email = String(credentials?.email ?? '');
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const user = await authService.validateUser(email, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          emailVerified: null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
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
});
