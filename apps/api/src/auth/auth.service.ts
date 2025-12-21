import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isUniqueConstraintError } from '../common/db-errors';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
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

  private sanitizeUser(user: User): Omit<User, 'hashedPassword'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private async signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
      tokenVersion: user.tokenVersion ?? 0,
    });
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
    const email = this.normalizeEmail(registerDto.email);
    const username = this.normalizeUsername(registerDto.username);
    const fullName = this.normalizeFullName(registerDto.fullName);
    const { password } = registerDto;

    // Check for existing user with same email
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check for existing user with same username
    const existingUserByUsername = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUserByUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password with argon2id only
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    // Create new user
    const user = this.userRepository.create({
      email,
      username,
      fullName,
      hashedPassword,
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
    });

    try {
      const savedUser = await this.userRepository.save(user);
      return this.sanitizeUser(savedUser);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or username already exists');
      }
      throw error;
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });

    if (user && (await argon2.verify(user.hashedPassword, password))) {
      return user;
    }

    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(this.normalizeEmail(email), password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.signAccessToken(user);
    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
  }

  async getOrCreateDemoUser(): Promise<Omit<User, 'hashedPassword'>> {
    const email = this.normalizeEmail(
      this.configService.get<string>('DEMO_EMAIL') || 'demo@isntgram.ai',
    );
    const username = this.normalizeUsername(
      this.configService.get<string>('DEMO_USERNAME') || 'demo',
    );
    const fullName = this.normalizeFullName(
      this.configService.get<string>('DEMO_FULL_NAME') || 'Demo User',
    );
    const demoPassword =
      this.configService.get<string>('DEMO_PASSWORD') || 'demo';

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      await this.ensureDemoPosts(existing.id);
      const refreshed = await this.userRepository.findOne({
        where: { id: existing.id },
      });
      return this.sanitizeUser(refreshed ?? existing);
    }

    const hashedPassword = await argon2.hash(demoPassword, {
      type: argon2.argon2id,
    });

    const demoUser = this.userRepository.create({
      email,
      username,
      fullName,
      hashedPassword,
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
    });

    const saved = await this.userRepository.save(demoUser);
    await this.ensureDemoPosts(saved.id);
    const refreshed = await this.userRepository.findOne({
      where: { id: saved.id },
    });
    return this.sanitizeUser(refreshed ?? saved);
  }

  private async ensureDemoPosts(userId: string): Promise<void> {
    const manager: EntityManager = this.userRepository.manager;

    const postRepository = manager.getRepository(Post);
    const userRepository = manager.getRepository(User);

    const existingCount = await postRepository.count({
      where: { authorId: userId },
    });
    if (existingCount > 0) {
      await userRepository.update(
        { id: userId },
        { postsCount: existingCount },
      );
      return;
    }

    const templates = [
      'Welcome to Isntgram — a signal-first feed for thoughtful updates.',
      'Working on something new this week: a lightweight Next.js + NestJS stack with contract-first APIs.',
      'Small wins compound. Today: improved observability and made the OpenAPI contract deterministic.',
    ];

    const now = Date.now();
    const posts = templates.map((content, index) =>
      postRepository.create({
        authorId: userId,
        content,
        createdAt: new Date(now - index * 60 * 60 * 1000),
        updatedAt: new Date(now - index * 60 * 60 * 1000),
      }),
    );

    await postRepository.save(posts);
    await userRepository.update({ id: userId }, { postsCount: posts.length });
  }
}
