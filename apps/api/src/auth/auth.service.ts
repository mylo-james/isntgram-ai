import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

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
    });
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
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
    return this.sanitizeUser(savedUser);
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

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.signAccessToken(user);
    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  async getOrCreateDemoUser(): Promise<Omit<User, 'hashedPassword'>> {
    const email =
      this.configService.get<string>('DEMO_EMAIL') || 'demo@isntgram.ai';
    const username = this.configService.get<string>('DEMO_USERNAME') || 'demo';
    const fullName =
      this.configService.get<string>('DEMO_FULL_NAME') || 'Demo User';
    const demoPassword =
      this.configService.get<string>('DEMO_PASSWORD') || 'demo';

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashedPassword: _hp, ...userWithoutPassword } = existing;
      return userWithoutPassword;
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
    return this.sanitizeUser(saved);
  }
}
