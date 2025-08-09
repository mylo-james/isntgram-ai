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

export class NestJSAdapter implements Adapter {
  constructor(private userRepository: Repository<User>) {}

  async createUser(user: AdapterUser) {
    const extendedUser = user as ExtendedAdapterUser;
    const newUser = this.userRepository.create({
      email: user.email || '',
      username: extendedUser.username || '',
      fullName: user.name || '',
      hashedPassword: extendedUser.password || '', // This should be hashed
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
    });

    const savedUser = await this.userRepository.save(newUser);
    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.fullName,
      emailVerified: null, // Add required field
    };
  }

  async getUser(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      emailVerified: null, // Add required field
    };
  }

  async getUserByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      emailVerified: null, // Add required field
    };
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
    user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>,
  ): Promise<AdapterUser> {
    const existingUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    const extendedUser = user as ExtendedAdapterUser;
    Object.assign(existingUser, {
      email: user.email,
      fullName: user.name,
      username: extendedUser.username,
    });

    const updatedUser = await this.userRepository.save(existingUser);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.fullName,
      emailVerified: null, // Add required field
    };
  }

  async deleteUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) return;

    await this.userRepository.remove(user);
  }

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
