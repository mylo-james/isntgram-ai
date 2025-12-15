import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { Post as PostEntity } from '../posts/entities/post.entity';
import { AuthUserDto } from './dto/auth-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
    private readonly configService: ConfigService,
  ) {}

  private toAuthUserDto(
    user: Pick<User, 'id' | 'email' | 'username' | 'fullName'>,
  ): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthUserDto> {
    const { email, username, fullName, password } = registerDto;

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

    const savedUser = await this.userRepository.save(user);

    return this.toAuthUserDto(savedUser);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user && (await argon2.verify(user.hashedPassword, password))) {
      return user;
    }

    return null;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async getOrCreateDemoUser(): Promise<AuthUserDto> {
    const email =
      this.configService.get<string>('DEMO_EMAIL') || 'demo@isntgram.ai';
    const username = this.configService.get<string>('DEMO_USERNAME') || 'demo';
    const fullName =
      this.configService.get<string>('DEMO_FULL_NAME') || 'Demo User';
    const demoPassword =
      this.configService.get<string>('DEMO_PASSWORD') || 'changeme';

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      await this.ensureDemoPosts(existing.id);
      return this.toAuthUserDto(existing);
    }

    const hashedPassword = await argon2.hash(demoPassword, {
      type: argon2.argon2id,
    });

    const demoUser = this.userRepository.create({
      email,
      username,
      fullName,
      hashedPassword,
      postsCount: 3,
      followerCount: 12,
      followingCount: 7,
    });

    const saved = await this.userRepository.save(demoUser);
    await this.ensureDemoPosts(saved.id);
    return this.toAuthUserDto(saved);
  }

  private async ensureDemoPosts(userId: string): Promise<void> {
    const existingCount = await this.postRepository.count({
      where: { userId },
    });
    if (existingCount > 0) {
      await this.userRepository.update(userId, { postsCount: existingCount });
      return;
    }

    const demoPosts = [
      'First post on Isntgram — hello world 👋',
      'Building a portfolio project with a real production baseline.',
      'Demo accounts are read-only, but you can still explore the app.',
    ].map((content) =>
      this.postRepository.create({
        userId,
        content,
      }),
    );

    await this.postRepository.save(demoPosts);
    await this.userRepository.update(userId, { postsCount: demoPosts.length });
  }
}
