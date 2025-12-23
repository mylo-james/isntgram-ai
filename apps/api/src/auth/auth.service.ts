import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { Repository } from 'typeorm';
import { isUniqueConstraintError } from '../common/db-errors';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.types';
import { PrivateUserProfileDto } from '../users/dto/private-user-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeUsername(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeFullName(value: string): string {
    return value.trim();
  }

  private toIsoDate(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  }

  toSafeUser(user: User): PrivateUserProfileDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      postCount: user.postsCount ?? 0,
      followerCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      createdAt: this.toIsoDate(user.createdAt),
      updatedAt: this.toIsoDate(user.updatedAt),
    };
  }

  async signAccessToken(
    user: Pick<User, 'id' | 'email' | 'username' | 'tokenVersion'>,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      tokenVersion: user.tokenVersion ?? 0,
    };
    return this.jwtService.signAsync(payload);
  }

  async register(dto: RegisterDto): Promise<PrivateUserProfileDto> {
    const email = this.normalizeEmail(dto.email);
    const username = this.normalizeUsername(dto.username);
    const fullName = this.normalizeFullName(dto.fullName);

    const existingEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = this.userRepository.create({
      email,
      username,
      fullName,
      hashedPassword,
      tokenVersion: 0,
      isDemoUser: false,
      isDemoSeed: false,
      demoExpiresAt: null,
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
    });

    try {
      const saved = await this.userRepository.save(user);
      return this.toSafeUser(saved);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or username already registered');
      }
      throw error;
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<PrivateUserProfileDto | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) return null;

    const ok = await argon2.verify(user.hashedPassword, password);
    if (!ok) return null;

    return this.toSafeUser(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    user: PrivateUserProfileDto;
    accessToken: string;
    isDemoUser?: boolean;
    demoExpiresAt?: string;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await argon2.verify(user.hashedPassword, password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isDemoUser && !user.isDemoSeed) {
      const expiresAt = user.demoExpiresAt;
      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Demo session expired');
      }
    }

    const accessToken = await this.signAccessToken(user);
    return {
      user: this.toSafeUser(user),
      accessToken,
      ...(user.isDemoUser && !user.isDemoSeed ? { isDemoUser: true } : {}),
      ...(user.demoExpiresAt
        ? { demoExpiresAt: user.demoExpiresAt.toISOString() }
        : {}),
    };
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
  }
}
