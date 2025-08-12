import { Test, TestingModule } from '@nestjs/testing';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { UsersService } from '../users/users.service';

describe('FollowsController', () => {
  let controller: FollowsController;
  let followsService: jest.Mocked<FollowsService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [
        {
          provide: FollowsService,
          useValue: {
            followUser: jest.fn(),
            unfollowUser: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByUsername: jest.fn().mockResolvedValue({ id: 'targetId' }),
          },
        },
      ],
    }).compile();

    controller = module.get<FollowsController>(FollowsController);
    followsService = module.get(FollowsService);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service to follow user', async () => {
    await controller.followUser('bob', { user: { userId: 'me' } } as any);
    expect(usersService.findByUsername).toHaveBeenCalledWith('bob');
    expect(followsService.followUser).toHaveBeenCalledWith('me', 'targetId');
  });

  it('should call service to unfollow user', async () => {
    await controller.unfollowUser('bob', { user: { userId: 'me' } } as any);
    expect(usersService.findByUsername).toHaveBeenCalledWith('bob');
    expect(followsService.unfollowUser).toHaveBeenCalledWith('me', 'targetId');
  });
});
