import { ConfigService } from '@nestjs/config';
import { type Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  it('throws when JWT_SECRET is missing', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const userRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<User>;

    expect(() => new JwtStrategy(configService, userRepository)).toThrow(
      'JWT_SECRET must be set',
    );
  });

  it('maps JWT payload to AuthUser', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        username: 'ava',
        tokenVersion: 0,
      }),
    } as unknown as Repository<User>;

    const strategy = new JwtStrategy(configService, userRepository);
    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'a@example.com',
        username: 'ava',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'a@example.com',
      username: 'ava',
    });
  });

  it('throws when user cannot be found', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<User>;

    const strategy = new JwtStrategy(configService, userRepository);
    await expect(
      strategy.validate({
        sub: 'missing',
        email: 'missing@example.com',
        username: 'missing',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when token version does not match', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        username: 'ava',
        tokenVersion: 2,
      }),
    } as unknown as Repository<User>;

    const strategy = new JwtStrategy(configService, userRepository);
    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'a@example.com',
        username: 'ava',
        tokenVersion: 1,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts tokens when stored tokenVersion is undefined', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-2',
        email: 'b@example.com',
        username: 'bryn',
        tokenVersion: undefined,
      }),
    } as unknown as Repository<User>;

    const strategy = new JwtStrategy(configService, userRepository);
    await expect(
      strategy.validate({
        sub: 'user-2',
        email: 'b@example.com',
        username: 'bryn',
      }),
    ).resolves.toEqual({
      userId: 'user-2',
      email: 'b@example.com',
      username: 'bryn',
    });
  });
});
