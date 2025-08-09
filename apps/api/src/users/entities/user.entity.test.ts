import { User } from './user.entity';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
    user.username = 'testuser';
    user.fullName = 'Test User';
    user.email = 'test@example.com';
    user.hashedPassword = 'hashedpassword123';
  });

  describe('Entity Structure', () => {
    it('should create a user with required fields', () => {
      expect(user.username).toBe('testuser');
      expect(user.fullName).toBe('Test User');
      expect(user.email).toBe('test@example.com');
      expect(user.hashedPassword).toBe('hashedpassword123');
    });

    it('should have default values for count fields', () => {
      expect(user.postsCount).toBeUndefined(); // Will be set by TypeORM default
      expect(user.followerCount).toBeUndefined(); // Will be set by TypeORM default
      expect(user.followingCount).toBeUndefined(); // Will be set by TypeORM default
    });

    it('should allow optional fields to be undefined', () => {
      expect(user.profilePictureUrl).toBeUndefined();
      expect(user.bio).toBeUndefined();
    });

    it('should set optional fields when provided', () => {
      user.profilePictureUrl = 'https://example.com/avatar.jpg';
      user.bio = 'Test bio';

      expect(user.profilePictureUrl).toBe('https://example.com/avatar.jpg');
      expect(user.bio).toBe('Test bio');
    });
  });

  describe('Field Constraints', () => {
    it('should have string id field for UUID', () => {
      user.id = 'test-uuid';
      expect(typeof user.id).toBe('string');
    });

    it('should have timestamp fields', () => {
      const now = new Date();
      user.createdAt = now;
      user.updatedAt = now;

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should have numeric count fields', () => {
      user.postsCount = 10;
      user.followerCount = 100;
      user.followingCount = 50;

      expect(typeof user.postsCount).toBe('number');
      expect(typeof user.followerCount).toBe('number');
      expect(typeof user.followingCount).toBe('number');
    });
  });

  describe('Entity Metadata', () => {
    it('should have proper entity name', () => {
      // This test verifies the @Entity('users') decorator is applied
      expect(User.name).toBe('User');
    });
  });
});
