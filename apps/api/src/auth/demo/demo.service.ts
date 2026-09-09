import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { isUniqueConstraintError } from '../../common/db-errors';
import { User } from '../../users/entities/user.entity';
import { PrivateUserProfileDto } from '../../users/dto/private-user-profile.dto';
import { AuthService } from '../auth.service';
import { CommunitySeeder } from './community.seeder';
import { DemoSeeder } from './demo.seeder';
import { CuratedDemoService } from './curated-demo.service';
import { AdmissionService } from '../../common/admission/admission.service';

@Injectable()
export class DemoService {
  private demoSessionQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly demoSeeder: DemoSeeder,
    @Optional() private readonly curatedDemoService?: CuratedDemoService,
    @Optional() private readonly communitySeeder?: CommunitySeeder,
    @Optional() private readonly admissionService?: AdmissionService,
  ) {}

  private async withDemoSessionLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.demoSessionQueue;
    let release!: () => void;
    this.demoSessionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private shouldSerializeDemoSessions(): boolean {
    const nodeEnv =
      this.configService.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';
    return nodeEnv === 'test' || nodeEnv === 'ci';
  }

  private getDemoTtlHours(): number {
    const raw = this.configService.get<string>('DEMO_TTL_HOURS') || '48';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 48;
    return Math.max(1, Math.floor(parsed));
  }

  private createDemoIdentity(): {
    email: string;
    username: string;
    fullName: string;
  } {
    // Keep usernames short and safe for regex constraints (lowercase + underscores).
    const id = randomUUID().replace(/-/g, '').slice(0, 12);
    const username = `demo_${id}`;
    return {
      email: `demo_${id}@demo.isntgram.local`,
      username,
      fullName: `Demo ${id}`,
    };
  }

  async createDemoSession(clientAddress = 'unknown'): Promise<{
    user: PrivateUserProfileDto;
    accessToken: string;
    isDemoUser: true;
    demoExpiresAt: string;
  }> {
    const operationId = randomUUID();
    if (this.admissionService?.isDeploymentMode()) {
      await this.admissionService.admitDemo(clientAddress, operationId);
    }
    try {
      if (this.configService.get<string>('DEMO_CONTENT_SOURCE') === 'curated') {
        if (!this.curatedDemoService)
          throw new ForbiddenException('Curated demo is unavailable');
        return await this.curatedDemoService.createSession();
      }
      if (this.shouldSerializeDemoSessions()) {
        return await this.withDemoSessionLock(() => this.createDemoSessionInternal());
      }
      return await this.createDemoSessionInternal();
    } finally {
      await this.admissionService?.completeDemo(operationId);
    }
  }

  private async createDemoSessionInternal(): Promise<{
    user: PrivateUserProfileDto;
    accessToken: string;
    isDemoUser: true;
    demoExpiresAt: string;
  }> {
    const ttlHours = this.getDemoTtlHours();
    const demoEnabled =
      this.configService.get<string>('DEMO_ENABLED') === 'true';
    if (!demoEnabled) {
      throw new ForbiddenException('Demo mode disabled');
    }

    const useCommunity =
      this.configService.get<string>('DEMO_CONTENT_SOURCE') === 'community';
    if (useCommunity && !this.communitySeeder)
      throw new ForbiddenException('Demo community is unavailable');
    const seedUsers = useCommunity
      ? await this.communitySeeder!.ensureCommunity()
      : await this.demoSeeder.ensureDemoSeedUsers();
    if (!useCommunity) {
      await this.demoSeeder.ensureDemoSeedPosts(seedUsers);
      await this.demoSeeder.seedDemoSeedEngagement(seedUsers);
    }

    const { email, username, fullName } = this.createDemoIdentity();
    const demoExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const hashedPassword = await argon2.hash(randomUUID(), {
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
      isDemoUser: true,
      isDemoSeed: false,
      demoExpiresAt,
      profilePictureUrl: useCommunity
        ? undefined
        : `https://picsum.photos/seed/${username}/200/200`,
      bio: 'Demo account • post, like, comment, and follow freely.',
    });

    try {
      const saved = await this.userRepository.save(demoUser);
      const demoPosts = useCommunity
        ? []
        : await this.demoSeeder.seedDemoUserPosts(saved);
      const followerUsers = await this.demoSeeder.seedDemoSocialGraph(
        saved.id,
        seedUsers,
      );
      await this.demoSeeder.seedDemoNotifications({
        demoUserId: saved.id,
        demoPosts,
        followerUsers,
      });

      const hydrated =
        (await this.userRepository.findOne({ where: { id: saved.id } })) ??
        saved;
      const accessToken = await this.authService.signAccessToken(hydrated);
      return {
        user: this.authService.toSafeUser(hydrated),
        accessToken,
        isDemoUser: true,
        demoExpiresAt: demoExpiresAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Extremely unlikely but possible; try again once.
        return this.createDemoSessionInternal();
      }
      throw error;
    }
  }
}
