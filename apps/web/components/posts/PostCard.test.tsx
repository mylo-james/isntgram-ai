import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "@/lib/api-client";
import PostCard from "./PostCard";

jest.mock("@/lib/api-client", () => ({
  apiClient: { likePost: jest.fn(), unlikePost: jest.fn() },
}));

const basePost = {
  id: "post-1",
  content: "Hello world",
  likeCount: 0,
  commentCount: 2,
  previewComments: [],
  likedByViewer: false,
  createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
  author: {
    id: "user-1",
    username: "jane",
    fullName: "Jane Thompson",
    profilePictureUrl: undefined,
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("PostCard", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
  });

  it("renders initials when no profile picture is present", () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByText("JT")).toBeInTheDocument();
    expect(screen.getAllByText("jane")[0]).toBeInTheDocument();
  });

  it("renders the profile picture when provided", () => {
    render(
      <PostCard
        post={{ ...basePost, author: { ...basePost.author, profilePictureUrl: "https://example.com/avatar.jpg" } }}
      />,
    );
    expect(document.querySelector('img[src="https://example.com/avatar.jpg"]')).toHaveAttribute(
      "src",
      "https://example.com/avatar.jpg",
    );
  });

  it("renders post media when mediaUrl is present", () => {
    render(<PostCard post={{ ...basePost, mediaUrl: "https://cdn.example.com/post.jpg" }} />);
    expect(screen.getByAltText("Photo attached to a post by jane")).toHaveAttribute(
      "src",
      "https://cdn.example.com/post.jpg",
    );
  });

  it("renders a semantic posted date with a short visible label and full accessible context", () => {
    const { container } = render(<PostCard post={basePost} />);
    const parsed = new Date(basePost.createdAt);
    const visibleLabel = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const accessibleLabel = parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const date = container.querySelector("time");
    expect(date).toHaveAttribute("dateTime", "2025-01-01T00:00:00.000Z");
    expect(date?.querySelector('[aria-hidden="true"]')).toHaveTextContent(visibleLabel);
    expect(date).toHaveTextContent(`Posted ${accessibleLabel}`);
  });

  it("renders no semantic date or invalid datetime when createdAt is invalid", () => {
    const { container } = render(<PostCard post={{ ...basePost, createdAt: "not-a-date" }} />);

    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/^Posted /)).not.toBeInTheDocument();
  });

  it("falls back to a generic initial when the author name is empty", () => {
    render(<PostCard post={{ ...basePost, author: { ...basePost.author, fullName: "" } }} />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("uses the authoritative like response and prevents duplicate clicks while pending", async () => {
    const pending = deferred<{ isLiked: boolean; likeCount: number }>();
    (apiClient.likePost as jest.Mock).mockReturnValueOnce(pending.promise);
    render(<PostCard post={basePost} />);

    const like = screen.getByRole("button", { name: "Like" });
    fireEvent.click(like);
    fireEvent.click(like);
    expect(apiClient.likePost).toHaveBeenCalledTimes(1);
    expect(like).toBeDisabled();
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 like")).toBeInTheDocument();

    await act(async () => pending.resolve({ isLiked: true, likeCount: 7 }));
    expect(screen.getByText("7 likes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlike" })).toBeEnabled();
  });

  it("rolls back a failed optimistic unlike and reports the error", async () => {
    (apiClient.unlikePost as jest.Mock).mockRejectedValueOnce(new Error("Your like wasn’t changed. Try again."));
    render(<PostCard post={{ ...basePost, likedByViewer: true, likeCount: 1 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlike" }));
    expect(screen.queryByText("0 likes")).not.toBeInTheDocument();
    await screen.findByText("Your like wasn’t changed. Try again.");
    expect(screen.getByRole("button", { name: "Unlike" })).toBeEnabled();
    expect(screen.getByText("1 like")).toBeInTheDocument();
  });

  it("shows oldest preview comments first with author and post links", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          previewComments: [
            {
              id: "new",
              postId: "post-1",
              content: "newest",
              likeCount: 0,
              likedByViewer: false,
              createdAt: "2025-01-02T00:00:00.000Z",
              updatedAt: "2025-01-02T00:00:00.000Z",
              author: { id: "new", username: "new-user", fullName: "New User" },
            },
            {
              id: "old",
              postId: "post-1",
              content: "oldest",
              likeCount: 0,
              likedByViewer: false,
              createdAt: "2025-01-01T00:00:00.000Z",
              updatedAt: "2025-01-01T00:00:00.000Z",
              author: { id: "old", username: "old-user", fullName: "Old User" },
            },
          ],
        }}
      />,
    );

    const oldest = screen.getByText("oldest");
    const newest = screen.getByText("newest");
    expect(oldest.compareDocumentPosition(newest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "old-user" })).toHaveAttribute("href", "/old-user");
    expect(screen.getByRole("link", { name: "Comment" })).toHaveAttribute("href", "/post/post-1");
  });

  it("dismisses the menu and provides temporary clipboard feedback", async () => {
    jest.useFakeTimers();
    (navigator.clipboard.writeText as jest.Mock).mockResolvedValueOnce(undefined);
    render(<PostCard post={basePost} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByRole("dialog", { name: "Post options" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/post/post-1`);
    act(() => jest.advanceTimersByTime(1200));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Post options" })).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("does not claim a copied link when the clipboard rejects", async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error("clipboard unavailable"));
    render(<PostCard post={basePost} />);
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });
});
