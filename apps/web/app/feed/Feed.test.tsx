import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Feed from "./Feed";
import { apiClient } from "@/lib/api-client";
import type { FeedResponse } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    getFeed: jest.fn(),
  },
}));

describe("Feed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders initial feed posts", () => {
    const initialFeed: FeedResponse = {
      posts: [
        {
          id: "101",
          content: "Hello world",
          likesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          author: { id: "user-1", username: "alice", fullName: "Alice" },
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, hasMore: false },
    };

    render(<Feed initialFeed={initialFeed} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("You’re all caught up.")).toBeInTheDocument();
  });

  it("loads feed when no initial feed is provided", async () => {
    (apiClient.getFeed as jest.Mock).mockResolvedValue({
      posts: [
        {
          id: "101",
          content: "Loaded post",
          likesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          author: { id: "user-1", username: "alice", fullName: "Alice" },
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, hasMore: false },
    } satisfies FeedResponse);

    render(<Feed />);

    await waitFor(() => expect(apiClient.getFeed).toHaveBeenCalledWith(1, 10));
    expect(await screen.findByText("Loaded post")).toBeInTheDocument();
  });

  it("can load more posts", async () => {
    const user = userEvent.setup();
    const initialFeed: FeedResponse = {
      posts: [
        {
          id: "101",
          content: "First post",
          likesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          author: { id: "user-1", username: "alice", fullName: "Alice" },
        },
      ],
      pagination: { page: 1, limit: 10, total: 2, hasMore: true },
    };

    (apiClient.getFeed as jest.Mock).mockResolvedValue({
      posts: [
        {
          id: "102",
          content: "Second post",
          likesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          author: { id: "user-2", username: "bob", fullName: "Bob" },
        },
      ],
      pagination: { page: 2, limit: 10, total: 2, hasMore: false },
    } satisfies FeedResponse);

    render(<Feed initialFeed={initialFeed} />);

    await user.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => expect(apiClient.getFeed).toHaveBeenCalledWith(2, 10));
    expect(await screen.findByText("Second post")).toBeInTheDocument();
  });
});
