import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

describe('PostsController', () => {
  let controller: PostsController;
  let service: jest.Mocked<PostsService>;

  const mockRequest = {
    user: { sub: 'user-1' },
  };

  const mockPostResponse = {
    id: 'post-1',
    userId: 'user-1',
    caption: 'Test post',
    imageUrl: 'https://example.com/image.jpg',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      username: 'testuser',
      fullName: 'Test User',
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
        caption: 'Test post',
        imageUrl: 'https://example.com/image.jpg',
      };
      service.createPost.mockResolvedValue(mockPostResponse);

      const result = await controller.createPost(mockRequest, createPostDto);

      expect(result).toEqual(mockPostResponse);
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
    it('should return a post', async () => {
      service.getPost.mockResolvedValue(mockPostResponse);

      const result = await controller.getPost('post-1');

      expect(result).toEqual(mockPostResponse);
      expect(service.getPost).toHaveBeenCalledWith('post-1');
    });
  });

  describe('getUserPosts', () => {
    it('should return user posts', async () => {
      const mockPosts = [mockPostResponse];
      service.getUserPosts.mockResolvedValue(mockPosts);

      const result = await controller.getUserPosts('testuser');

      expect(result).toEqual(mockPosts);
      expect(service.getUserPosts).toHaveBeenCalledWith('testuser', 1, 12);
    });

    it('should handle pagination parameters', async () => {
      const mockPosts = [mockPostResponse];
      service.getUserPosts.mockResolvedValue(mockPosts);

      await controller.getUserPosts('testuser', 2, 6);

      expect(service.getUserPosts).toHaveBeenCalledWith('testuser', 2, 6);
    });
  });

  describe('getFeed', () => {
    it('should return feed posts', async () => {
      const mockPosts = [mockPostResponse];
      service.getFeed.mockResolvedValue(mockPosts);

      const result = await controller.getFeed(mockRequest);

      expect(result).toEqual(mockPosts);
      expect(service.getFeed).toHaveBeenCalledWith('user-1', 1, 10);
    });

    it('should handle pagination parameters', async () => {
      const mockPosts = [mockPostResponse];
      service.getFeed.mockResolvedValue(mockPosts);

      await controller.getFeed(mockRequest, 3, 5);

      expect(service.getFeed).toHaveBeenCalledWith('user-1', 3, 5);
    });
  });
});