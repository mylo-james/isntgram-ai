import {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from '@auth/core/adapters';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';

// Extended interface for our custom user properties
interface ExtendedAdapterUser extends AdapterUser {
  username?: string;
  password?: string;
}

// Disabled insecure adapter: it could store plaintext passwords if used.
// Keeping the class exported for potential future implementation, but methods are no-ops.
export class NestJSAdapter implements Adapter {
  constructor(private userRepository: Repository<User>) {}

  async createUser(_user: AdapterUser): Promise<AdapterUser> {
    throw new Error('Adapter disabled: not implemented securely');
  }

  async getUser(_id: string) {
    return null;
  }

  async getUserByEmail(_email: string) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUserByAccount(_params: {
    provider: string;
    providerAccountId: string;
  }) {
    // This would need to be implemented if you want to support OAuth providers
    return null;
  }

  async updateUser(
    _user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>,
  ): Promise<AdapterUser> {
    throw new Error('Adapter disabled: not implemented securely');
  }

  async deleteUser(_userId: string) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async linkAccount(account: AdapterAccount): Promise<void> {
    // This would need to be implemented if you want to support OAuth providers
    // For now, just return void as required by the interface
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async unlinkAccount(_params: {
    provider: string;
    providerAccountId: string;
  }) {
    // This would need to be implemented if you want to support OAuth providers
    return undefined;
  }

  async createSession(session: {
    sessionToken: string;
    userId: string;
    expires: Date;
  }): Promise<AdapterSession> {
    // For JWT strategy, this is not needed but we must return the expected type
    return {
      sessionToken: session.sessionToken,
      userId: session.userId,
      expires: session.expires,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSessionAndUser(_sessionToken: string) {
    // For JWT strategy, this is not needed
    return null;
  }

  async updateSession(
    session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>,
  ): Promise<AdapterSession | null | undefined> {
    // For JWT strategy, this is not needed but we must return the expected type
    return {
      sessionToken: session.sessionToken,
      userId: session.userId || '',
      expires: session.expires || new Date(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteSession(_sessionToken: string) {
    // For JWT strategy, this is not needed
    return null;
  }

  async createVerificationToken(
    verificationToken: VerificationToken,
  ): Promise<VerificationToken | null | undefined> {
    // This would need to be implemented if you want email verification
    return verificationToken;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async useVerificationToken(_params: { identifier: string; token: string }) {
    // This would need to be implemented if you want email verification
    return null;
  }
}
