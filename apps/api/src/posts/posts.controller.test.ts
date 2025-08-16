import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/post.dto';

describe('PostsController', () => {
  let controller: PostsController;
  let service: jest.Mocked<PostsService>;

  const mockRequest = {
    user: { sub: 'user-1' },
  };

  const mockPostResponse = {
    id: 'post-1',
    userId: 'user-1',
    caption: 'Test caption',
    imageUrl: 'https://example.com/image.jpg',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      username: 'testuser',
      fullName: 'Test User',
      profilePictureUrl: undefined,
    },
  };

  beforeEach(async () => {
    const mockService = {
      createPost: jest.fn(),
      deletePost: jest.fn(),
      getPost: jest.fn(),
      getUserPosts: jest.fn(),
      getFeed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PostsController>(PostsController);
    service = module.get(PostsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const createPostDto: CreatePostDto = {
        caption: 'Test caption',
        imageUrl: 'https://example.com/image.jpg',
      };
      service.createPost.mockResolvedValue(mockPostResponse);

      const result = await controller.createPost(mockRequest, createPostDto);

      expect(result).toEqual(mockPostResponse);
      expect(service.createPost).toHaveBeenCalledWith('user-1', createPostDto);
    });

    it('should create a post without caption', async () => {
      const createPostDto: CreatePostDto = {
        imageUrl: 'https://example.com/image.jpg',
      };
      const postWithoutCaption = { ...mockPostResponse, caption: undefined };
      service.createPost.mockResolvedValue(postWithoutCaption);

      const result = await controller.createPost(mockRequest, createPostDto);

      expect(result).toEqual(postWithoutCaption);
      expect(service.createPost).toHaveBeenCalledWith('user-1', createPostDto);
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      const deleteResponse = { message: 'Post deleted successfully' };
      service.deletePost.mockResolvedValue(deleteResponse);

      const result = await controller.deletePost(mockRequest, 'post-1');

      expect(result).toEqual(deleteResponse);
      expect(service.deletePost).toHaveBeenCalledWith('user-1', 'post-1');
    });
  });

  describe('getPost', () => {
    it('should return a post successfully', async () => {
      service.getPost.mockResolvedValue(mockPostResponse);

      const result = await controller.getPost('post-1');

      expect(result).toEqual(mockPostResponse);
      expect(service.getPost).toHaveBeenCalledWith('post-1');
    });
  });

  describe('getUserPosts', () => {
    it('should return user posts with default pagination', async () => {
      const posts = [mockPostResponse];
      service.getUserPosts.mockResolvedValue(posts);

      const result = await controller.getUserPosts('testuser');

      expect(result).toEqual(posts);
      expect(service.getUserPosts).toHaveBeenCalledWith('testuser', 1, 12);
    });

    it('should return user posts with custom pagination', async () => {
      const posts = [mockPostResponse];
      service.getUserPosts.mockResolvedValue(posts);

      const result = await controller.getUserPosts('testuser', 2, 5);

      expect(result).toEqual(posts);
      expect(service.getUserPosts).toHaveBeenCalledWith('testuser', 2, 5);
    });

    it('should handle string pagination parameters', async () => {
      const posts = [mockPostResponse];
      service.getUserPosts.mockResolvedValue(posts);

      // Simulate query parameters as strings
      const result = await controller.getUserPosts('testuser', '3' as any, '10' as any);

      expect(result).toEqual(posts);
      expect(service.getUserPosts).toHaveBeenCalledWith('testuser', 3, 10);
    });
  });

  describe('getFeed', () => {
    it('should return feed with default pagination', async () => {
      const posts = [mockPostResponse];
      service.getFeed.mockResolvedValue(posts);

      const result = await controller.getFeed(mockRequest);

      expect(result).toEqual(posts);
      expect(service.getFeed).toHaveBeenCalledWith('user-1', 1, 10);
    });

    it('should return feed with custom pagination', async () => {
      const posts = [mockPostResponse];
      service.getFeed.mockResolvedValue(posts);

      const result = await controller.getFeed(mockRequest, 2, 5);

      expect(result).toEqual(posts);
      expect(service.getFeed).toHaveBeenCalledWith('user-1', 2, 5);
    });

    it('should handle string pagination parameters', async () => {
      const posts = [mockPostResponse];
      service.getFeed.mockResolvedValue(posts);

      // Simulate query parameters as strings
      const result = await controller.getFeed(mockRequest, '3' as any, '15' as any);

      expect(result).toEqual(posts);
      expect(service.getFeed).toHaveBeenCalledWith('user-1', 3, 15);
    });
  });
});