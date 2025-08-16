import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/post.dto';

describe('PostsService', () => {
  let service: PostsService;
  let postRepository: jest.Mocked<Repository<Post>>;
  let userRepository: jest.Mocked<Repository<User>>;

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
    caption: 'Test caption',
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
    };

    const mockUserRepository = {
      increment: jest.fn(),
      decrement: jest.fn(),
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
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postRepository = module.get(getRepositoryToken(Post));
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPost', () => {
    const createPostDto: CreatePostDto = {
      caption: 'Test caption',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should create a post successfully', async () => {
      postRepository.create.mockReturnValue(mockPost);
      postRepository.save.mockResolvedValue(mockPost);
      postRepository.findOne.mockResolvedValue(mockPost);
      userRepository.increment.mockResolvedValue({} as any);

      const result = await service.createPost('user-1', createPostDto);

      expect(postRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        caption: createPostDto.caption,
        imageUrl: createPostDto.imageUrl,
      });
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(userRepository.increment).toHaveBeenCalledWith(
        { id: 'user-1' },
        'postsCount',
        1,
      );
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

    it('should create a post without caption', async () => {
      const postWithoutCaption = { ...mockPost, caption: undefined };
      const createPostDtoWithoutCaption = { imageUrl: 'https://example.com/image.jpg' };

      postRepository.create.mockReturnValue(postWithoutCaption);
      postRepository.save.mockResolvedValue(postWithoutCaption);
      postRepository.findOne.mockResolvedValue(postWithoutCaption);
      userRepository.increment.mockResolvedValue({} as any);

      const result = await service.createPost('user-1', createPostDtoWithoutCaption);

      expect(result.caption).toBeUndefined();
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);
      postRepository.remove.mockResolvedValue(mockPost);
      userRepository.decrement.mockResolvedValue({} as any);

      const result = await service.deletePost('user-1', 'post-1');

      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
      expect(postRepository.remove).toHaveBeenCalledWith(mockPost);
      expect(userRepository.decrement).toHaveBeenCalledWith(
        { id: 'user-1' },
        'postsCount',
        1,
      );
      expect(result).toEqual({ message: 'Post deleted successfully' });
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(service.deletePost('user-1', 'post-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user tries to delete another user\'s post', async () => {
      const otherUserPost = { ...mockPost, userId: 'user-2' };
      postRepository.findOne.mockResolvedValue(otherUserPost);

      await expect(service.deletePost('user-1', 'post-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getPost', () => {
    it('should return a post successfully', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      const result = await service.getPost('post-1');

      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        relations: ['user'],
      });
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

      await expect(service.getPost('post-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPosts', () => {
    it('should return user posts successfully', async () => {
      const posts = [mockPost];
      postRepository.find.mockResolvedValue(posts);

      const result = await service.getUserPosts('testuser', 1, 12);

      expect(postRepository.find).toHaveBeenCalledWith({
        where: { user: { username: 'testuser' } },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 12,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPost.id);
    });

    it('should handle pagination correctly', async () => {
      postRepository.find.mockResolvedValue([]);

      await service.getUserPosts('testuser', 2, 5);

      expect(postRepository.find).toHaveBeenCalledWith({
        where: { user: { username: 'testuser' } },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 5,
        skip: 5,
      });
    });
  });

  describe('getFeed', () => {
    it('should return feed posts successfully', async () => {
      const posts = [mockPost];
      postRepository.find.mockResolvedValue(posts);

      const result = await service.getFeed('user-1', 1, 10);

      expect(postRepository.find).toHaveBeenCalledWith({
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPost.id);
    });

    it('should handle pagination correctly', async () => {
      postRepository.find.mockResolvedValue([]);

      await service.getFeed('user-1', 3, 5);

      expect(postRepository.find).toHaveBeenCalledWith({
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 5,
        skip: 10,
      });
    });
  });
});