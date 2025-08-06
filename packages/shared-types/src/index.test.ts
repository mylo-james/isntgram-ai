import { User, Post, ApiResponse } from "./index";

describe("Shared Types", () => {
  describe("User interface", () => {
    it("should have required properties", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        isVerified: false,
        createdAt: new Date(),
      };

      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.firstName).toBeDefined();
    });

    it("should allow optional properties", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Test bio",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.lastName).toBe("User");
      expect(user.avatarUrl).toBeDefined();
      expect(user.bio).toBeDefined();
    });
  });

  describe("Post interface", () => {
    it("should have required properties", () => {
      const post: Post = {
        id: "1",
        userId: "1",
        content: "Test post",
        likes: 0,
        comments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(post.id).toBeDefined();
      expect(post.userId).toBeDefined();
      expect(post.content).toBeDefined();
    });

    it("should allow optional mediaUrls", () => {
      const post: Post = {
        id: "1",
        userId: "1",
        content: "Test post",
        mediaUrls: ["https://example.com/image.jpg"],
        likes: 0,
        comments: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(post.mediaUrls).toHaveLength(1);
    });
  });

  describe("ApiResponse interface", () => {
    it("should handle success response", () => {
      const response: ApiResponse<string> = {
        success: true,
        data: "test data",
        message: "Success",
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe("test data");
    });

    it("should handle error response", () => {
      const response: ApiResponse<null> = {
        success: false,
        error: "Something went wrong",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });
});
