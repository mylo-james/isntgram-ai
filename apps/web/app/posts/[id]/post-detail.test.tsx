import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PostDetail from "./post-detail";
import { apiClient } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import type { ReactElement } from "react";

jest.mock("next-auth/react", () => ({ useSession: jest.fn() }));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    getPostById: jest.fn(),
    getComments: jest.fn(),
    createComment: jest.fn(),
    deleteComment: jest.fn(),
    deletePost: jest.fn(),
    likePost: jest.fn(),
    unlikePost: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function renderWithProviders(ui: ReactElement) {
  return render(ui);
}

describe("Post detail comments", () => {
  beforeEach(() => {
    (useSession as unknown as jest.Mock).mockReturnValue({
      status: "authenticated",
      data: { user: { id: "user-1", isDemoUser: false } },
    });
    (apiClient.getPostById as jest.Mock).mockResolvedValue({
      id: "post-1",
      content: "Hello from post",
      likesCount: 0,
      commentsCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "author-1", username: "alice", fullName: "Alice" },
    });
    (apiClient.getComments as jest.Mock).mockResolvedValue({
      comments: [],
      pagination: { page: 1, limit: 20, total: 0, hasMore: false },
    });
    (apiClient.createComment as jest.Mock).mockResolvedValue({
      id: "comment-1",
      text: "Nice post",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "user-1", username: "user", fullName: "User" },
    });
  });

  it("can create a comment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostDetail postId="post-1" />);

    await waitFor(() => expect(apiClient.getPostById).toHaveBeenCalledWith("post-1"));
    await waitFor(() => expect(apiClient.getComments).toHaveBeenCalled());

    const commentInput = await screen.findByLabelText(/add a comment/i);
    await user.type(commentInput, "Nice post");
    await user.click(screen.getByRole("button", { name: /post comment/i }));

    await waitFor(() => expect(apiClient.createComment).toHaveBeenCalledWith("post-1", "Nice post"));
    expect(await screen.findByText("Nice post")).toBeInTheDocument();
  });
});
