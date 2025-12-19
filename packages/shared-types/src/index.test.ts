import { FeedResponse, PostItem, PublicUserProfile, UploadUrlResponse } from "./index";

describe("Shared Types", () => {
  it("should allow public user profile shape", () => {
    const user: PublicUserProfile = {
      id: "1",
      username: "testuser",
      fullName: "Test User",
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(user.username).toBe("testuser");
    expect(user.postCount).toBe(0);
  });

  it("should allow feed response shape", () => {
    const post: PostItem = {
      id: "1",
      content: "Hello",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "1",
        username: "testuser",
        fullName: "Test User",
      },
    };

    const feed: FeedResponse = {
      items: [post],
      nextCursor: "cursor",
    };

    expect(feed.items[0].content).toBe("Hello");
  });

  it("should allow upload url response shape", () => {
    const upload: UploadUrlResponse = {
      uploadUrl: "https://example.com/upload",
      publicUrl: "https://example.com/public",
      key: "uploads/1/file.jpg",
      expiresIn: 900,
    };

    expect(upload.expiresIn).toBe(900);
  });
});
