import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Comment, PostItem } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  __esModule: true,
  apiClient: {
    likePost: jest.fn(),
    unlikePost: jest.fn(),
    getComments: jest.fn(),
    createComment: jest.fn(),
    likeComment: jest.fn(),
    unlikeComment: jest.fn(),
  },
}));
jest.mock("@/components/ui/Dialog", () => ({
  __esModule: true,
  default: function MockDialog({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  },
}));

import PostDetailClient from "./PostDetailClient";

const mockApi = (jest.requireMock("@/lib/api-client") as { apiClient: Record<string, jest.Mock> }).apiClient;

const post = {
  id: "post-1",
  content: "A post",
  likeCount: 1,
  commentCount: 1,
  likedByViewer: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  author: { id: "author-1", username: "author", fullName: "Author Name" },
};
const comment = (id: string, content: string) => ({
  id,
  content,
  likeCount: 0,
  likedByViewer: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  author: { id: `author-${id}`, username: `person-${id}`, fullName: `Person ${id}` },
});

describe("PostDetailClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
  });

  it("exposes a complete post date and omits invalid semantic dates", () => {
    const datedPost = { ...post, createdAt: "2026-01-15T12:00:00.000Z" } as unknown as PostItem;
    const { container, rerender } = render(<PostDetailClient post={datedPost} initialComments={[]} />);
    const date = container.querySelector("time");
    expect(date).toHaveAttribute("datetime", "2026-01-15T12:00:00.000Z");
    expect(date).not.toHaveAttribute("aria-label");
    expect(screen.getByText("Jan 15")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Posted January 15, 2026")).not.toHaveAttribute("aria-hidden");
    rerender(<PostDetailClient post={{ ...datedPost, createdAt: "invalid" }} initialComments={[]} />);
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/Posted January/)).not.toBeInTheDocument();
  });

  it("adopts the server like total and rolls the visible state back after failure", async () => {
    mockApi.likePost.mockResolvedValue({ isLiked: true, likeCount: 3 });
    mockApi.unlikePost.mockRejectedValue(new Error("offline"));
    render(<PostDetailClient post={post as unknown as PostItem} initialComments={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    await waitFor(() => expect(screen.getByText("3 likes")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Unlike" }));
    await waitFor(() => expect(screen.getByText(/your like wasn’t changed/i)).toBeInTheDocument());
    expect(screen.getByText("3 likes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlike" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/your like wasn’t changed/i);
  });

  it("uses the current cursor for manual comments pagination and renders chronological order", async () => {
    mockApi.getComments.mockResolvedValue({ items: [comment("second", "second comment")], nextCursor: undefined });
    render(
      <PostDetailClient
        post={post as unknown as PostItem}
        initialComments={[comment("first", "first comment") as unknown as Comment]}
        initialCursor="cursor-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load more comments/i }));
    await waitFor(() => expect(mockApi.getComments).toHaveBeenCalledWith("post-1", { cursor: "cursor-1" }));
    const rendered = screen.getAllByText(/(first|second) comment/).map((element) => element.textContent);
    expect(rendered).toEqual(
      expect.arrayContaining([expect.stringContaining("second comment"), expect.stringContaining("first comment")]),
    );
    expect(rendered[0]).toContain("second comment");
    expect(screen.queryByRole("button", { name: /load more comments/i })).not.toBeInTheDocument();
  });

  it("retains loaded comments after a pagination failure and permits an explicit retry", async () => {
    mockApi.getComments
      .mockRejectedValueOnce(new Error("comments unavailable"))
      .mockResolvedValueOnce({ items: [comment("second", "second comment")], nextCursor: undefined });
    render(
      <PostDetailClient
        post={post as unknown as PostItem}
        initialComments={[comment("first", "first comment") as unknown as Comment]}
        initialCursor="cursor-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load more comments/i }));
    await waitFor(() => expect(screen.getByText(/comments couldn’t load/i)).toBeInTheDocument());
    expect(screen.getByText("first comment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry comments/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /retry comments/i }));
    await waitFor(() => expect(mockApi.getComments).toHaveBeenCalledTimes(2));
    expect(screen.getByText("first comment")).toBeInTheDocument();
    expect(screen.getByText("second comment")).toBeInTheDocument();
    expect(screen.queryByText(/comments couldn’t load/i)).not.toBeInTheDocument();
  });

  it("uses the server comment reaction state and restores it after an unlike failure", async () => {
    mockApi.likeComment.mockResolvedValue({ isLiked: true, likeCount: 4 });
    mockApi.unlikeComment.mockRejectedValue(new Error("reaction unavailable"));
    render(
      <PostDetailClient
        post={post as unknown as PostItem}
        initialComments={[comment("reaction", "a reaction") as unknown as Comment]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Like comment" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unlike comment" })).toBeInTheDocument());
    expect(screen.getByText("4 likes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unlike comment" }));
    await waitFor(() => expect(screen.getByText(/comment like wasn’t changed/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Unlike comment" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("4 likes")).toBeInTheDocument();
  });

  it("posts trimmed comments only after success and retains a failed draft for correction", async () => {
    mockApi.createComment
      .mockResolvedValueOnce(comment("created", "new comment"))
      .mockRejectedValueOnce(new Error("unavailable"));
    render(<PostDetailClient post={post as unknown as PostItem} initialComments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    const input = screen.getByRole("textbox", { name: "Add a comment" });

    fireEvent.change(input, { target: { value: "  new comment  " } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    await waitFor(() => expect(mockApi.createComment).toHaveBeenCalledWith("post-1", { content: "new comment" }));
    expect(input).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Comments (2)" })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    const feedback = await screen.findByRole("alert");
    expect(feedback).toHaveTextContent("Your comment wasn’t added");
    expect(input).toHaveValue("keep this draft");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "comment-help comment-error");
  });

  it("reveals and focuses the editor above viewer comments, then closes it with Escape", async () => {
    render(
      <PostDetailClient
        post={post as unknown as PostItem}
        viewerId="viewer"
        initialComments={[
          { ...comment("other-first", "other first") } as unknown as Comment,
          {
            ...comment("mine", "my comment"),
            author: { id: "viewer", username: "me", fullName: "Me" },
          } as unknown as Comment,
          { ...comment("other-last", "other last") } as unknown as Comment,
        ]}
      />,
    );

    const commentButton = screen.getByRole("button", { name: "Comment" });
    expect(commentButton.parentElement).toHaveClass("justify-end");
    expect(screen.queryByRole("textbox", { name: "Add a comment" })).not.toBeInTheDocument();

    fireEvent.click(commentButton);
    const input = screen.getByRole("textbox", { name: "Add a comment" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(commentButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("my comment"),
      expect.stringContaining("other last"),
      expect.stringContaining("other first"),
    ]);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Add a comment" })).not.toBeInTheDocument();
    expect(commentButton).toHaveFocus();
    expect(commentButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows copied only after the clipboard accepts the current post URL", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<PostDetailClient post={post as unknown as PostItem} initialComments={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/post\/post-1$/));
  });

  it("does not claim a copied link when the clipboard rejects it", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<PostDetailClient post={post as unknown as PostItem} initialComments={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });
});
