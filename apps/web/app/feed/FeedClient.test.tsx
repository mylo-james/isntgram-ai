import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FeedResponse } from "@/lib/api-client";

let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;

jest.mock("@/lib/api-client", () => ({ __esModule: true, apiClient: { getFeed: jest.fn() } }));
jest.mock("@/components/posts/PostCard", () => ({
  __esModule: true,
  default: function MockPostCard({ post }: { post: { id: string } }) {
    return <article>{post.id}</article>;
  },
}));

import FeedClient from "./FeedClient";

const getFeed = (jest.requireMock("@/lib/api-client") as { apiClient: { getFeed: jest.Mock } }).apiClient.getFeed;

function feedWith(id: string, nextCursor: string | undefined): FeedResponse {
  return { items: [{ id } as unknown as FeedResponse["items"][number]], nextCursor };
}

class TestIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    observerCallback = callback;
  }
  observe() {}
  disconnect() {}
}

describe("FeedClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observerCallback = undefined;
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: TestIntersectionObserver });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "IntersectionObserver");
  });

  it("fetches only after Load more is selected, appends the page, and reaches the terminal state", async () => {
    getFeed.mockResolvedValue({ items: [{ id: "second" }], nextCursor: undefined });
    render(<FeedClient initialFeed={feedWith("first", "cursor-1")} />);

    await act(async () => observerCallback?.([{ isIntersecting: false }]));
    expect(getFeed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    await waitFor(() => expect(getFeed).toHaveBeenCalledWith({ cursor: "cursor-1" }));
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("keeps existing posts and restores the user-visible state when pagination fails", async () => {
    getFeed.mockRejectedValue(new Error("offline"));
    render(<FeedClient initialFeed={feedWith("first", "cursor-1")} />);

    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    await waitFor(() => expect(screen.getByText(/more posts couldn’t load/i)).toBeInTheDocument());
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders a valid empty feed distinctly from a failed page request", () => {
    render(<FeedClient initialFeed={{ items: [], nextCursor: undefined }} />);
    expect(screen.getByText(/your feed is ready for a first post/i)).toBeInTheDocument();
  });
});
