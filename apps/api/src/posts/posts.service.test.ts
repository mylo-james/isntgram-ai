import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { Follow } from '../follows/entities/follows.entity';
import { CreatePostDto } from './dto/create-post.dto';

describe('PostsService', () => {
  let service: PostsService;
  let postRepository: jest.Mocked<Repository<Post>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let followRepository: jest.Mocked<Repository<Follow>>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    hashedPassword: 'hashedpassword',
    postsCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPost: Post = {
    id: 'post-1',
    userId: 'user-1',
    caption: 'Test post caption',
    imageUrl: 'https://example.com/image.jpg',
    likesCount: 0,
    commentsCount: 0,
    user: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPostRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };

    const mockFollowRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Follow),
          useValue: mockFollowRepository,
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postRepository = module.get(getRepositoryToken(Post));
    userRepository = module.get(getRepositoryToken(User));
    followRepository = module.get(getRepositoryToken(Follow));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPost', () => {
    const createPostDto: CreatePostDto = {
      caption: 'Test post caption',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should create a post successfully', async () => {
      postRepository.create.mockReturnValue(mockPost);
      postRepository.save.mockResolvedValue(mockPost);
      userRepository.increment.mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.createPost('user-1', createPostDto);

      expect(result).toEqual({
        id: mockPost.id,
        userId: mockPost.userId,
        caption: mockPost.caption,
        imageUrl: mockPost.imageUrl,
        likesCount: mockPost.likesCount,
        commentsCount: mockPost.commentsCount,
        createdAt: mockPost.createdAt,
        updatedAt: mockPost.updatedAt,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.fullName,
          profilePictureUrl: mockUser.profilePictureUrl,
        },
      });
      expect(userRepository.increment).toHaveBeenCalledWith({ id: 'user-1' }, 'postsCount', 1);
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);
      postRepository.remove.mockResolvedValue(mockPost);
      userRepository.decrement.mockResolvedValue(undefined);

      const result = await service.deletePost('user-1', 'post-1');

      expect(result).toEqual({ message: 'Post deleted successfully' });
      expect(userRepository.decrement).toHaveBeenCalledWith({ id: 'user-1' }, 'postsCount', 1);
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(service.deletePost('user-1', 'post-1'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user tries to delete another user\'s post', async () => {
      const otherUserPost = { ...mockPost, userId: 'other-user' };
      postRepository.findOne.mockResolvedValue(otherUserPost);

      await expect(service.deletePost('user-1', 'post-1'))
        .rejects
        .toThrow(ForbiddenException);
    });
  });

  describe('getPost', () => {
    it('should return a post successfully', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      const result = await service.getPost('post-1');

      expect(result).toEqual({
        id: mockPost.id,
        userId: mockPost.userId,
        caption: mockPost.caption,
        imageUrl: mockPost.imageUrl,
        likesCount: mockPost.likesCount,
        commentsCount: mockPost.commentsCount,
        createdAt: mockPost.createdAt,
        updatedAt: mockPost.updatedAt,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.fullName,
          profilePictureUrl: mockUser.profilePictureUrl,
        },
      });
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(service.getPost('post-1'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getUserPosts', () => {
    it('should return user posts successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      postRepository.find.mockResolvedValue([mockPost]);

      const result = await service.getUserPosts('testuser');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPost.id);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserPosts('nonexistentuser'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getFeed', () => {
    it('should return feed posts successfully', async () => {
      const mockFollows = [{ followingId: 'user-2' }];
      followRepository.find.mockResolvedValue(mockFollows as any);
      
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockPost]),
      };
      
      postRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getFeed('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPost.id);
    });

    it('should return user\'s own posts when user follows no one', async () => {
      followRepository.find.mockResolvedValue([]);
      
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockPost]),
      };
      
      postRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getFeed('user-1');

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'post.userId IN (:...userIds)', 
        { userIds: ['user-1'] }
      );
    });
  });
});