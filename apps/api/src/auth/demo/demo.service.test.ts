import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import { DemoSeeder } from './demo.seeder';
import { DemoService } from './demo.service';

jest.mock('argon2');

describe('DemoService', () => {
  let service: DemoService;
  let userRepository: Repository<User>;
  let configService: ConfigService;

  const mockDemoSeeder = {
    ensureDemoSeedUsers: jest.fn(),
    ensureDemoSeedPosts: jest.fn(),
    seedDemoSeedEngagement: jest.fn(),
    seedDemoUserPosts: jest.fn(),
    seedDemoSocialGraph: jest.fn(),
    seedDemoNotifications: jest.fn(),
  };

  const mockAuthService = {
    signAccessToken: jest.fn().mockResolvedValue('jwt-token'),
    toSafeUser: jest.fn((user: User) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      postCount: user.postsCount ?? 0,
      followerCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      createdAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: DemoSeeder,
          useValue: mockDemoSeeder,
        },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('throws when demo mode is disabled', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'DEMO_ENABLED') return 'false';
      return undefined;
    });

    await expect(service.createDemoSession()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates a new demo session and returns token + expiry', async () => {
    const nowMs = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'DEMO_ENABLED') return 'true';
      if (key === 'DEMO_TTL_HOURS') return '48';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });

    const seedUsers = [
      {
        id: 'seed-1',
        username: 'demo_seed_1',
        fullName: 'Demo Seed 1',
        email: 'demo_seed_1@demo.isntgram.local',
        hashedPassword: 'hashed',
        tokenVersion: 0,
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        isDemoUser: true,
        isDemoSeed: true,
        demoExpiresAt: null,
      } as unknown as User,
    ];

    mockDemoSeeder.ensureDemoSeedUsers.mockResolvedValue(seedUsers);
    mockDemoSeeder.ensureDemoSeedPosts.mockResolvedValue(undefined);
    mockDemoSeeder.seedDemoSeedEngagement.mockResolvedValue(undefined);
    mockDemoSeeder.seedDemoUserPosts.mockResolvedValue([]);
    mockDemoSeeder.seedDemoSocialGraph.mockResolvedValue(seedUsers);
    mockDemoSeeder.seedDemoNotifications.mockResolvedValue(undefined);

    (argon2.hash as jest.Mock).mockResolvedValueOnce('hashed-demo');

    let savedUser: User | null = null;
    (userRepository.save as jest.Mock).mockImplementationOnce(
      async (user: Partial<User>) => {
        savedUser = {
          id: 'demo-1',
          tokenVersion: 0,
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          ...user,
        } as User;
        return savedUser;
      },
    );

    (userRepository.findOne as jest.Mock).mockImplementationOnce(async () => {
      return savedUser;
    });

    const result = await service.createDemoSession();

    expect(result.isDemoUser).toBe(true);
    expect(result.accessToken).toBe('jwt-token');
    expect(result.user).toHaveProperty('id', 'demo-1');
    expect(result.user.email).toMatch(/^demo_[a-z0-9]+@demo\.isntgram\.local$/);
    expect(result.user.username).toMatch(/^demo_[a-z0-9]+$/);
    expect(result.user.fullName).toMatch(/^Demo [a-z0-9]+$/);
    expect(result.demoExpiresAt).toBe(
      new Date(nowMs + 48 * 60 * 60 * 1000).toISOString(),
    );

    expect(mockDemoSeeder.ensureDemoSeedUsers).toHaveBeenCalledTimes(1);
    expect(mockAuthService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'demo-1' }),
    );
    expect(mockAuthService.toSafeUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'demo-1' }),
    );
  });
});
