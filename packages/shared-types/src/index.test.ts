import { User, Post, ApiResponse } from './index';

describe('Shared Types', () => {
  describe('User interface', () => {
    it('should have required properties', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBe('1');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow optional properties', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.displayName).toBe('Test User');
      expect(user.avatar).toBe('https://example.com/avatar.jpg');
      expect(user.bio).toBe('Test bio');
    });
  });

  describe('Post interface', () => {
    it('should have required properties', () => {
      const post: Post = {
        id: '1',
        userId: 'user1',
        content: 'Test post content',
        likes: 0,
        comments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(post.id).toBe('1');
      expect(post.userId).toBe('user1');
      expect(post.content).toBe('Test post content');
      expect(post.likes).toBe(0);
      expect(post.comments).toBe(0);
    });

    it('should allow optional mediaUrls', () => {
      const post: Post = {
        id: '1',
        userId: 'user1',
        content: 'Test post with media',
        mediaUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        likes: 5,
        comments: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(post.mediaUrls).toHaveLength(2);
      expect(post.mediaUrls![0]).toBe('https://example.com/image1.jpg');
    });
  });

  describe('ApiResponse interface', () => {
    it('should handle success response', () => {
      const response: ApiResponse<User> = {
        success: true,
        data: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: 'User created successfully',
      };

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.message).toBe('User created successfully');
    });

    it('should handle error response', () => {
      const response: ApiResponse<User> = {
        success: false,
        error: 'User not found',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('User not found');
    });
  });
}); 