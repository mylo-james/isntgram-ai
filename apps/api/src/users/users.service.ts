import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface UserProfileDto {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User with username "${username}" not found`);
    }

    return user;
  }

  async getUserProfile(username: string): Promise<UserProfileDto> {
    const user = await this.findByUsername(username);

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      postCount: user.postsCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }
}
