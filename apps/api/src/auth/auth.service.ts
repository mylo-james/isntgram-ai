import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

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

    // Return user without hashed password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.hashedPassword))) {
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
}
